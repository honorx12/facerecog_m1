"""
FaceRecognitionModel
Encoding, caching, and matching logic — separated from webcam/DB/UI code.
Photos live in Supabase Storage (bucket "known-faces"); this module mirrors
them into a local folder so face_recognition can read plain files, then
encodes/caches exactly as before.
"""

import os
import pickle
import numpy as np
import face_recognition

from supabase_client import anon_client, BUCKET


class FaceRecognitionModel:
    def __init__(self, faces_dir="known_faces", cache_path="encodings_cache.pkl", threshold=0.5):
        self.faces_dir = faces_dir
        self.cache_path = cache_path
        self.threshold = threshold
        self.encodings = []
        self.names = []

    # ---- sync from Supabase Storage ----
    def sync_from_storage(self):
        """Mirror the known-faces bucket into faces_dir. Called after every
        register/rename/delete so the local cache used for encoding matches
        Storage exactly. Local files no longer in the bucket are removed."""
        os.makedirs(self.faces_dir, exist_ok=True)
        sb = anon_client()
        remote = sb.storage.from_(BUCKET).list()
        remote_names = set()
        for obj in remote:
            fname = obj["name"]
            remote_names.add(fname)
            local_path = os.path.join(self.faces_dir, fname)
            if not os.path.exists(local_path):
                data = sb.storage.from_(BUCKET).download(fname)
                with open(local_path, "wb") as f:
                    f.write(data)

        for fname in list(os.listdir(self.faces_dir)):
            if fname not in remote_names and fname.lower().endswith((".jpg", ".jpeg", ".png")):
                os.remove(os.path.join(self.faces_dir, fname))

    # ---- registration ----
    def register(self, image_path, name):
        img = face_recognition.load_image_file(image_path)
        found = face_recognition.face_encodings(img)
        if not found:
            print(f"[SKIP] no face in {image_path}")
            return False
        self.encodings.append(found[0])
        self.names.append(name)
        return True

    def load_folder(self, folder=None):
        """Register every image in folder. Filename (minus extension) = name."""
        folder = folder or self.faces_dir
        if not os.path.isdir(folder):
            os.makedirs(folder, exist_ok=True)
            print(f"[INFO] created '{folder}/' - add photos, rerun")
            return
        for fname in sorted(os.listdir(folder)):
            if fname.lower().endswith((".jpg", ".jpeg", ".png")):
                self.register(os.path.join(folder, fname), os.path.splitext(fname)[0])

    # ---- caching ----
    def _folder_signature(self):
        """Cheap change-detector: filenames + mtimes in faces_dir."""
        if not os.path.isdir(self.faces_dir):
            return ()
        return tuple(sorted(
            (f, os.path.getmtime(os.path.join(self.faces_dir, f)))
            for f in os.listdir(self.faces_dir)
        ))

    def load(self):
        """Sync photos from Storage, then load encodings from cache if
        faces_dir unchanged; else re-encode and re-cache."""
        self.sync_from_storage()
        sig = self._folder_signature()
        if os.path.exists(self.cache_path):
            with open(self.cache_path, "rb") as f:
                cached_sig, encodings, names = pickle.load(f)
            if cached_sig == sig:
                self.encodings, self.names = encodings, names
                print(f"[CACHE] loaded {len(names)} face(s), skipped re-encoding")
                return
        # cache missing or stale -> rebuild
        self.encodings, self.names = [], []
        self.load_folder()
        with open(self.cache_path, "wb") as f:
            pickle.dump((sig, self.encodings, self.names), f)
        print(f"[CACHE] rebuilt, saved {len(self.names)} face(s)")

    # ---- matching ----
    def match(self, face_encoding):
        """Best match for one encoding. Returns (name, distance) or ('Unknown', distance)."""
        if not self.encodings:
            return None, None
        distances = face_recognition.face_distance(self.encodings, face_encoding)
        best = np.argmin(distances)
        if distances[best] < self.threshold:
            return self.names[best], float(distances[best])
        return "Unknown", float(distances[best])

    def match_frame(self, rgb_small_frame):
        """Detect + encode + match every face in one frame.
        Returns list of (name, distance, (top, right, bottom, left))."""
        locations = face_recognition.face_locations(rgb_small_frame)
        encodings = face_recognition.face_encodings(rgb_small_frame, locations)
        results = []
        for loc, enc in zip(locations, encodings):
            name, dist = self.match(enc)
            results.append((name or "Unknown", dist, loc))
        return results

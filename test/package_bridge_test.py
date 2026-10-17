from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from package_bridge import package, FILES


class BridgePackageTest(unittest.TestCase):
    def test_public_allowlist_only(self):
        with tempfile.TemporaryDirectory() as temp:
            result = package(destination=Path(temp) / 'bridge.zip')
            with zipfile.ZipFile(result) as archive:
                self.assertEqual(set(archive.namelist()), {f'cyd-bridge/{n}' for n in FILES})
                self.assertFalse(any('/artifacts/' in n or '/.env' in n or '/.git/' in n for n in archive.namelist()))
                self.assertIn('cyd-bridge/server/guide.mjs', archive.namelist())

    def test_symlink_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'package.json').symlink_to(ROOT / 'package.json')
            with self.assertRaises(ValueError):
                package(root=root, destination=root / 'bundle.zip')


if __name__ == '__main__':
    unittest.main()

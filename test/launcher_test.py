from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).parents[1]


class LauncherTest(unittest.TestCase):
    def test_native_snake_swipes_hit_regions_and_status(self):
        with tempfile.TemporaryDirectory(prefix='launcher-test-', dir=ROOT / 'artifacts') as directory:
            binary = str(Path(directory) / 'launcher-test')
            subprocess.run(['clang++', '-std=c++17', '-Wall', '-Wextra', '-Werror',
                            '-fsanitize=address,undefined', str(ROOT / 'test/launcher_test.cpp'),
                            '-o', binary], check=True, timeout=30)
            subprocess.run([binary], check=True, timeout=10)


if __name__ == '__main__':
    unittest.main()

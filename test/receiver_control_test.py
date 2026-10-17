import importlib.util
from pathlib import Path
import unittest
import argparse

SPEC = importlib.util.spec_from_file_location('receiver_control', Path(__file__).parents[1] / 'scripts/receiver_control.py')
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class ReceiverControlTest(unittest.TestCase):
    def test_bridge_validation(self):
        self.assertEqual(module.bridge_url('http://192.168.178.61:3088'), 'http://192.168.178.61:3088')
        for bad in ['https://192.168.1.1:3088', 'http://localhost:3088', 'http://user:secret@192.168.1.1:3088', 'http://192.168.1.1:3088/preview', 'http://192.168.1.1:0']:
            with self.assertRaises(argparse.ArgumentTypeError):
                module.bridge_url(bad)

    def test_diagnostics_are_allowlisted(self):
        self.assertIsNone(module.public_line('Password: fixture-do-not-print'))
        self.assertIsNone(module.public_line('Setup portal secret'))
        self.assertEqual(module.public_line('CYDSTATUS {"wifi":true,"password":"fixture-do-not-print"}'), {'status': {'wifi': True}})
        self.assertEqual(module.public_line('CYDPERF draws=40 window_ms=5000 receive_ms=30 draw_ms=80')['drawnFps'], 8)
        self.assertEqual(module.public_line('CYDCONTROL OK resume'), {'control':'OK resume'})

    def test_ack_matches_the_requested_command(self):
        self.assertEqual(module.expected_ack('?CYDSPI=40'), 'CYDCONTROL OK spi')
        self.assertNotEqual(module.expected_ack('?CYDSPI=40'), 'CYDCONTROL OK spi-fallback')
        self.assertEqual(module.expected_ack('?CYDBRIDGE=http://192.168.1.1:3088'), 'CYDCONTROL OK bridge')

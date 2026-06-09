#!/usr/bin/env python3
"""
Spin Wheels - Giveaway Picker | Ritual Testnet
Local Dev HTTP Server Helper
"""

import http.server
import socketserver
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def main():
    os.chdir(DIRECTORY)
    print(f"Starting Dev Server for Spin Wheels...")
    print(f"Serving files from: {DIRECTORY}")
    
    # Allow port reuse to avoid 'address already in use' errors
    socketserver.TCPServer.allow_reuse_address = True
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"\n🚀 Server running at: http://localhost:{PORT}")
            print("Press Ctrl+C to stop the server.\n")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server. Goodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

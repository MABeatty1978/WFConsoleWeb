#!/usr/bin/env python3
"""
Build script for WFConsoleWeb - Packages frontend and backend together.

This script:
1. Builds the React frontend
2. Copies frontend distribution to backend static directory
3. Creates Python distribution package
4. Generates platform-specific installers
"""

import os
import sys
import subprocess
import shutil
import json
from pathlib import Path


class Colors:
    """ANSI color codes"""
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_header(text):
    """Print a formatted header"""
    width = 70
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*width}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}  {text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*width}{Colors.END}\n")


def print_step(text):
    """Print a step message"""
    print(f"{Colors.BOLD}[*]{Colors.END} {text}")


def print_ok(text):
    """Print success message"""
    print(f"{Colors.GREEN}[OK]{Colors.END} {text}")


def print_error(text):
    """Print error message"""
    print(f"{Colors.RED}[ERROR]{Colors.END} {text}")


def print_warning(text):
    """Print warning message"""
    print(f"{Colors.YELLOW}[WARNING]{Colors.END} {text}")


def run_command(cmd, description=None, cwd=None):
    """Run a shell command"""
    if description:
        print_step(description)
    
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            check=True,
            cwd=cwd,
            capture_output=True,
            text=True
        )
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        if description:
            print_error(f"{description} failed")
        print(f"Command: {cmd}")
        print(f"Output: {e.stderr}")
        return False, e.stderr


def main():
    """Main build function"""
    print_header("WFConsoleWeb Build & Package Script")
    
    root_dir = Path(__file__).parent.absolute()
    frontend_dir = root_dir / "wfconsoleweb" / "frontend"
    backend_dir = root_dir / "wfconsoleweb" / "backend"
    
    # Check Python version
    print_step("Checking Python version...")
    if sys.version_info < (3, 9):
        print_error(f"Python 3.9+ required, found {sys.version_info.major}.{sys.version_info.minor}")
        return False
    print_ok(f"Python {sys.version_info.major}.{sys.version_info.minor} detected")
    
    # Change to root directory
    os.chdir(root_dir)
    
    # Step 1: Check if frontend directory exists
    print_step("Checking frontend directory...")
    if not frontend_dir.exists():
        print_warning(f"Frontend directory not found: {frontend_dir}")
        print_warning("Skipping frontend build...")
    else:
        print_ok(f"Frontend directory found: {frontend_dir}")
        
        # Step 2: Check Node.js
        print_step("Checking Node.js installation...")
        success, output = run_command("npm --version")
        if not success:
            print_error("Node.js/npm not found. Install from https://nodejs.org")
            print_warning("Continuing without frontend build...")
        else:
            print_ok(f"npm version: {output.strip()}")
            
            # Step 3: Install frontend dependencies
            print_step("Installing frontend dependencies...")
            success, _ = run_command(
                "npm install",
                cwd=frontend_dir
            )
            if not success:
                print_error("Failed to install frontend dependencies")
                return False
            print_ok("Frontend dependencies installed")
            
            # Step 4: Build frontend
            print_step("Building React frontend...")
            success, output = run_command(
                "npm run build",
                cwd=frontend_dir
            )
            if not success:
                print_error("Frontend build failed")
                return False
            print_ok("Frontend built successfully")
            
            # Step 5: Copy frontend dist to backend static
            print_step("Copying frontend distribution...")
            dist_dir = frontend_dir / "build"
            static_dir = backend_dir / "static"
            
            if dist_dir.exists():
                # Clear existing static directory
                if static_dir.exists():
                    shutil.rmtree(static_dir)
                    print_ok("Cleared existing static directory")
                
                # Copy new distribution
                shutil.copytree(dist_dir, static_dir)
                print_ok(f"Frontend copied to {static_dir}")
            else:
                print_warning(f"Build directory not found: {dist_dir}")
    
    # Step 6: Clean previous builds
    print_step("Cleaning previous build artifacts...")
    for pattern in ["build", "dist", "*.egg-info"]:
        for path in root_dir.glob(pattern):
            if path.is_dir():
                shutil.rmtree(path)
                print_ok(f"Removed: {path.name}")
    
    # Step 7: Upgrade build tools
    print_step("Upgrading build tools...")
    success, output = run_command(
        "python -m pip install --upgrade pip setuptools wheel build twine"
    )
    if not success:
        print_error("Failed to upgrade build tools")
        return False
    print_ok("Build tools upgraded")
    
    # Step 8: Build Python package
    print_step("Building Python package...")
    success, output = run_command(
        "python -m build"
    )
    if not success:
        print_error("Package build failed")
        return False
    print_ok("Python package built successfully")
    
    # Step 9: Display build artifacts
    print_header("Build Complete!")
    
    dist_dir = root_dir / "dist"
    if dist_dir.exists():
        print("Distribution packages created:")
        total_size = 0
        for file in sorted(dist_dir.glob("*")):
            size_bytes = file.stat().st_size
            size_mb = size_bytes / (1024 * 1024)
            total_size += size_bytes
            print(f"  - {file.name:<50} ({size_mb:>6.2f} MB)")
        
        total_mb = total_size / (1024 * 1024)
        print(f"\n  Total size: {total_mb:.2f} MB")
    
    # Step 10: Installation instructions
    print_header("Installation Instructions")
    
    print("To install the built package locally:")
    print("  pip install dist/wfconsoleweb-*.whl")
    print()
    print("To install for development:")
    print("  pip install -e .")
    print()
    print("To upload to PyPI (requires credentials):")
    print("  python -m twine upload dist/*")
    print()
    
    # Platform-specific instructions
    print("Platform-specific installation:")
    if sys.platform == "win32":
        print("  Windows: Run install-windows.bat")
    else:
        print("  Linux/Unix: Run ./install-linux.sh")
    print()
    
    print_header("Next Steps")
    
    print("1. Test the installation:")
    print("     pip install dist/wfconsoleweb-*.whl")
    print("     wfconsoleweb")
    print()
    print("2. Access the web interface:")
    print("     http://localhost:8000")
    print()
    print("3. Complete initial setup (API key, device ID, etc.)")
    print()
    print("4. Review deployment documentation:")
    print("     DEPLOYMENT.md")
    print()
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

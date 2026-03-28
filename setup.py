"""Setup configuration for WFConsoleWeb"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="wfconsoleweb",
    version="0.1.0a1",
    author="WFConsoleWeb Contributors",
    description="Web interface for the Tempest weather station by WeatherFlow",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/WFConsoleWeb",
    project_urls={
        "Bug Tracker": "https://github.com/yourusername/WFConsoleWeb/issues",
        "Source Code": "https://github.com/yourusername/WFConsoleWeb",
    },
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Development Status :: 3 - Alpha",
        "Intended Audience :: End Users/Desktop",
        "Topic :: Home Automation",
    ],
    python_requires=">=3.9",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "wfpiconsole-web=wfpiconsole.backend.main:main",
        ],
    },
    include_package_data=True,
    package_data={
        "wfpiconsole": [
            "frontend/dist/**/*",
            "themes/**/*",
        ],
    },
)

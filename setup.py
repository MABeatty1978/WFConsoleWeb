"""Setup configuration for WFConsoleWeb"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

with open("requirements-dev.txt", "r", encoding="utf-8") as fh:
    dev_requirements = [
        line.strip()
        for line in fh
        if line.strip() and not line.startswith("#") and not line.startswith("-r")
    ]

setup(
    name="wfconsoleweb",
    version="0.2.0",
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
    extras_require={
        "dev": dev_requirements,
    },
    entry_points={
        "console_scripts": [
            "wfconsoleweb=wfconsoleweb.backend.main:main",
        ],
    },
    include_package_data=True,
    package_data={
        "wfconsoleweb": [
            "frontend/dist/**/*",
            "themes/**/*",
        ],
    },
)

import subprocess
import os
import logging

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

version_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "VERSION.txt")

with open(version_file, "r") as f:
    version = f.read().strip()

commit_message = f"BliForest v{version}"

logging.info(f"Versi: {version}")
logging.info(f"Message: {commit_message}\n")

subprocess.run(["git", "add", "."], check=True)
logging.info("git add done")

result = subprocess.run(["git", "commit", "-m", commit_message], capture_output=True, text=True)
if result.returncode != 0:
    logging.error(result.stderr)
    exit(1)
logging.info("git commit done")

result = subprocess.run(["git", "push"], capture_output=True, text=True)
if result.returncode != 0:
    logging.error(result.stderr)
    exit(1)
logging.info("git push done")
logging.info("SIAP!")

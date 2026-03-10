import os

import uvicorn

from main import app


def main() -> None:
    host = os.environ.get("BYUNGHOON_HOST", "127.0.0.1")
    port = int(os.environ.get("BYUNGHOON_PORT", "18400"))
    uvicorn.run(app, host=host, port=port, reload=False, access_log=False)


if __name__ == "__main__":
    main()

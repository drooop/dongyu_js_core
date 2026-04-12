#!/usr/bin/env python3

import argparse
import http.cookiejar
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path


IMPORTER_HOST_TARGET = {"model_id": 1030, "p": 2, "r": 4, "c": 0}
IMPORTER_TRUTH_TARGET = {"model_id": 1031, "p": 0, "r": 0, "c": 0, "k": "slide_import_media_uri"}


class SlideInstallClient:
    def __init__(self, base_url: str, timeout: float = 20.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.cookie_jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookie_jar))

    def _request_json(self, path: str, *, method: str = "GET", payload=None, headers=None, raw_body=None):
        body = raw_body
        req_headers = {"accept": "application/json"}
        if headers:
            req_headers.update(headers)
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            req_headers["content-type"] = "application/json; charset=utf-8"
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=body,
            headers=req_headers,
            method=method,
        )
        try:
            with self.opener.open(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return resp.status, data
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                data = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                data = {"ok": False, "error": raw or exc.reason}
            return exc.code, data

    def login(self, homeserver_url: str, username: str, password: str):
        status, data = self._request_json(
            "/auth/login",
            method="POST",
            payload={
                "homeserverUrl": homeserver_url,
                "username": username,
                "password": password,
            },
        )
        if status != 200 or data.get("ok") is not True:
            raise RuntimeError(f"/auth/login failed: status={status} body={data}")
        return data

    def upload_zip(self, zip_path: Path):
        body = zip_path.read_bytes()
        status, data = self._request_json(
            f"/api/media/upload?filename={urllib.parse.quote(zip_path.name)}",
            method="POST",
            headers={"content-type": "application/zip"},
            raw_body=body,
        )
        if status != 200 or data.get("ok") is not True or not data.get("uri"):
            raise RuntimeError(f"/api/media/upload failed: status={status} body={data}")
        return data

    def post_ui_event(self, envelope: dict):
        status, data = self._request_json("/ui_event", method="POST", payload=envelope)
        if status != 200 or data.get("ok") is not True:
            raise RuntimeError(f"/ui_event failed: status={status} body={data}")
        if data.get("result") == "error":
            raise RuntimeError(f"/ui_event returned error result: {data}")
        return data

    def snapshot(self):
        status, data = self._request_json("/snapshot")
        if status != 200 or "snapshot" not in data:
            raise RuntimeError(f"/snapshot failed: status={status} body={data}")
        return data["snapshot"]

    def ensure_runtime_running(self):
        status, data = self._request_json(
            "/api/runtime/mode",
            method="POST",
            payload={"mode": "running"},
        )
        if status != 200 or data.get("ok") is not True:
            raise RuntimeError(f"/api/runtime/mode failed: status={status} body={data}")
        return data

    def write_import_media_uri(self, uri: str):
        op_id = f"slide_import_uri_{int(time.time() * 1000)}"
        envelope = {
            "event_id": int(time.time() * 1000),
            "type": "ui_owner_label_update",
            "payload": {
                "action": "ui_owner_label_update",
                "meta": {"op_id": op_id},
                "target": IMPORTER_TRUTH_TARGET,
                "value": {"t": "str", "v": uri},
            },
            "source": "python_slide_install_client",
            "ts": int(time.time() * 1000),
        }
        return self.post_ui_event(envelope)

    def trigger_import_click(self):
        op_id = f"slide_import_click_{int(time.time() * 1000)}"
        envelope = {
            "event_id": int(time.time() * 1000),
            "type": "click",
            "payload": {
                "meta": {"op_id": op_id},
                "target": IMPORTER_HOST_TARGET,
                "pin": "click",
                "value": {"click": True},
            },
            "source": "python_slide_install_client",
            "ts": int(time.time() * 1000),
        }
        return self.post_ui_event(envelope)


def infer_app_name(zip_path: Path) -> str:
    with zipfile.ZipFile(zip_path) as zf:
        candidates = [name for name in zf.namelist() if name.lower().endswith(".json")]
        if not candidates:
            return ""
        target = "app_payload.json" if "app_payload.json" in candidates else candidates[0]
        payload = json.loads(zf.read(target).decode("utf-8"))
    if not isinstance(payload, list):
        return ""
    for record in payload:
        if not isinstance(record, dict):
            continue
        if record.get("id") == 0 and record.get("k") == "app_name" and isinstance(record.get("v"), str):
            return record["v"].strip()
    return ""


def extract_result(snapshot: dict, expected_app_name: str):
    labels = (
        snapshot.get("models", {})
        .get("1031", {})
        .get("cells", {})
        .get("0,0,0", {})
        .get("labels", {})
    )
    registry = (
        snapshot.get("models", {})
        .get("-2", {})
        .get("cells", {})
        .get("0,0,0", {})
        .get("labels", {})
        .get("ws_apps_registry", {})
        .get("v", [])
    )
    status = labels.get("slide_import_status", {}).get("v", "")
    last_name = labels.get("slide_import_last_app_name", {}).get("v", "")
    last_id = labels.get("slide_import_last_app_id", {}).get("v", 0)
    matched = None
    if isinstance(registry, list):
        for entry in registry:
            if not isinstance(entry, dict):
                continue
            if expected_app_name and entry.get("name") == expected_app_name:
                matched = entry
                break
            if last_name and entry.get("name") == last_name:
                matched = entry
                break
    return {
        "status": status,
        "last_app_name": last_name,
        "last_app_id": last_id,
        "registry_match": matched,
    }


def build_parser():
    parser = argparse.ArgumentParser(
        description="Install one slide app zip into the current ui-server via the supported upload -> importer chain.",
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:30900", help="ui-server base URL")
    parser.add_argument("--zip", required=True, help="Path to slide app zip")
    parser.add_argument("--homeserver-url", help="Matrix homeserver URL for /auth/login")
    parser.add_argument("--username", help="Matrix username for /auth/login")
    parser.add_argument("--password", help="Matrix password for /auth/login")
    parser.add_argument("--timeout", type=float, default=20.0, help="HTTP timeout seconds")
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    zip_path = Path(args.zip).expanduser().resolve()
    if not zip_path.is_file():
        raise SystemExit(f"zip_not_found: {zip_path}")

    login_values = [args.homeserver_url, args.username, args.password]
    if any(login_values) and not all(login_values):
        raise SystemExit("login_args_incomplete: --homeserver-url --username --password must be provided together")

    client = SlideInstallClient(args.base_url, timeout=args.timeout)
    expected_app_name = infer_app_name(zip_path)

    result = {
        "base_url": args.base_url.rstrip("/"),
        "zip": str(zip_path),
        "expected_app_name": expected_app_name,
        "login": None,
        "upload": None,
        "runtime_mode": None,
        "write_media_uri": None,
        "trigger_import": None,
        "final": None,
    }

    if all(login_values):
        result["login"] = client.login(args.homeserver_url, args.username, args.password)

    upload = client.upload_zip(zip_path)
    result["upload"] = upload
    result["runtime_mode"] = client.ensure_runtime_running()
    result["write_media_uri"] = client.write_import_media_uri(upload["uri"])
    result["trigger_import"] = client.trigger_import_click()

    snapshot = client.snapshot()
    final_result = extract_result(snapshot, expected_app_name)
    result["final"] = final_result

    registry_match = final_result.get("registry_match")
    if not registry_match:
        raise SystemExit(f"install_not_visible_in_workspace: {json.dumps(result, ensure_ascii=False)}")

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

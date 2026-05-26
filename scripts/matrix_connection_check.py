#!/usr/bin/env python3
"""Check local Matrix connectivity for drop -> mbr.

The script intentionally uses only Python's standard library so it can run in a
fresh local checkout. It reads local deployment env files by default and never
prints access tokens or passwords.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOCAL_ENV = REPO_ROOT / "deploy" / "env" / "local.env"
DEFAULT_GENERATED_ENV = REPO_ROOT / "deploy" / "env" / "local.generated.env"


class MatrixCheckError(RuntimeError):
    pass


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            values[key] = value
    return values


def merged_env(local_env: Path, generated_env: Path) -> dict[str, str]:
    values = {}
    values.update(read_env_file(local_env))
    values.update(read_env_file(generated_env))
    for key, value in os.environ.items():
        if value:
            values[key] = value
    return values


def run_text(cmd: list[str], timeout: float = 8.0) -> str:
    try:
        result = subprocess.run(
            cmd,
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
        )
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise MatrixCheckError(f"command_failed:{' '.join(cmd)}:{exc}") from exc
    return result.stdout.strip()


def normalize_base_url(url: str) -> str:
    text = str(url or "").strip()
    if not text:
        return ""
    return text.rstrip("/")


def discover_homeserver(args: argparse.Namespace, env: dict[str, str]) -> str:
    for value in [
        args.homeserver,
        env.get("MATRIX_HOMESERVER_URL", ""),
        env.get("HOMESERVER_URL", ""),
        env.get("SYNAPSE_HOMESERVER_URL", ""),
    ]:
        normalized = normalize_base_url(value)
        if normalized:
            return normalized

    namespace = args.namespace or env.get("NAMESPACE") or "dongyu"
    cluster_ip = run_text([
        "kubectl",
        "-n",
        namespace,
        "get",
        "svc",
        "synapse",
        "-o",
        "jsonpath={.spec.clusterIP}",
    ])
    if not cluster_ip:
        raise MatrixCheckError("synapse_service_ip_missing")
    return f"http://{cluster_ip}:8008"


def matrix_url(base_url: str, path: str, query: dict[str, str] | None = None) -> str:
    url = f"{base_url}/_matrix/client/v3{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    return url


def http_json(
    method: str,
    url: str,
    *,
    token: str | None = None,
    payload: dict[str, Any] | None = None,
    timeout: float = 10.0,
    allow_not_found: bool = False,
) -> tuple[int, dict[str, Any]]:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw or "{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        if allow_not_found and exc.code == 404:
            return exc.code, {}
        detail = raw[:500]
        raise MatrixCheckError(f"http_{exc.code}:{url}:{detail}") from exc
    except urllib.error.URLError as exc:
        raise MatrixCheckError(f"url_error:{url}:{exc}") from exc


def ping_homeserver(base_url: str, timeout: float) -> bool:
    try:
        url = f"{base_url}/_matrix/client/versions"
        status, _body = http_json("GET", url, timeout=timeout)
        return 200 <= status < 300
    except MatrixCheckError:
        return False


def start_port_forward(namespace: str, local_port: int) -> subprocess.Popen:
    process = subprocess.Popen(
        [
            "kubectl",
            "-n",
            namespace,
            "port-forward",
            "svc/synapse",
            f"{local_port}:8008",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return process


def ensure_reachable_homeserver(
    base_url: str,
    args: argparse.Namespace,
    env: dict[str, str],
) -> tuple[str, subprocess.Popen | None]:
    if ping_homeserver(base_url, args.timeout):
        return base_url, None
    if args.no_port_forward:
        raise MatrixCheckError(f"homeserver_unreachable:{base_url}")

    namespace = args.namespace or env.get("NAMESPACE") or "dongyu"
    process = start_port_forward(namespace, args.port_forward_port)
    forwarded = f"http://127.0.0.1:{args.port_forward_port}"
    deadline = time.time() + args.timeout
    while time.time() < deadline:
        if ping_homeserver(forwarded, 1.0):
            return forwarded, process
        time.sleep(0.25)

    try:
        process.terminate()
    except OSError:
        pass
    raise MatrixCheckError(f"homeserver_unreachable:{base_url};port_forward_failed:{forwarded}")


def user_id(localpart: str, server_name: str) -> str:
    text = str(localpart or "").strip()
    if text.startswith("@"):
        return text
    return f"@{text}:{server_name}"


def login(base_url: str, localpart_or_user_id: str, password: str, timeout: float) -> tuple[str, str]:
    if not password:
        raise MatrixCheckError(f"password_missing:{localpart_or_user_id}")
    status, body = http_json(
        "POST",
        matrix_url(base_url, "/login"),
        payload={
            "type": "m.login.password",
            "identifier": {"type": "m.id.user", "user": localpart_or_user_id},
            "password": password,
        },
        timeout=timeout,
    )
    if status < 200 or status >= 300:
        raise MatrixCheckError("matrix_login_failed")
    token = str(body.get("access_token") or "")
    resolved_user_id = str(body.get("user_id") or "")
    if not token or not resolved_user_id:
        raise MatrixCheckError("matrix_login_missing_token")
    return token, resolved_user_id


def whoami(base_url: str, token: str, timeout: float) -> str:
    _status, body = http_json("GET", matrix_url(base_url, "/account/whoami"), token=token, timeout=timeout)
    resolved = str(body.get("user_id") or "")
    if not resolved:
        raise MatrixCheckError("whoami_missing_user_id")
    return resolved


def resolve_auth(
    base_url: str,
    env: dict[str, str],
    args: argparse.Namespace,
) -> tuple[dict[str, str], dict[str, str]]:
    server_name = env.get("SYNAPSE_SERVER_NAME", "localhost")
    drop_local = args.drop_user or env.get("SERVER_USER", "drop")
    mbr_local = args.mbr_user or env.get("MBR_USER", "mbr")
    drop_user_id = user_id(drop_local, server_name)
    mbr_user_id = user_id(mbr_local, server_name)

    drop_token = args.drop_token or env.get("SERVER_ACCESS_TOKEN") or env.get("DROP_ACCESS_TOKEN") or ""
    mbr_token = args.mbr_token or env.get("MBR_ACCESS_TOKEN") or env.get("MATRIX_MBR_BOT_ACCESS_TOKEN") or ""

    if drop_token:
        try:
            drop_user_id = whoami(base_url, drop_token, args.timeout)
        except MatrixCheckError:
            drop_token = ""
    if not drop_token:
        drop_token, drop_user_id = login(base_url, drop_user_id, env.get("SERVER_PASSWORD", ""), args.timeout)

    if mbr_token:
        try:
            mbr_user_id = whoami(base_url, mbr_token, args.timeout)
        except MatrixCheckError:
            mbr_token = ""
    if not mbr_token:
        mbr_token, mbr_user_id = login(base_url, mbr_user_id, env.get("MBR_PASSWORD", ""), args.timeout)

    return (
        {"user_id": drop_user_id, "token": drop_token},
        {"user_id": mbr_user_id, "token": mbr_token},
    )


def joined_rooms(base_url: str, token: str, timeout: float) -> list[str]:
    _status, body = http_json("GET", matrix_url(base_url, "/joined_rooms"), token=token, timeout=timeout)
    rooms = body.get("joined_rooms")
    if not isinstance(rooms, list):
        raise MatrixCheckError("joined_rooms_response_invalid")
    return [room for room in rooms if isinstance(room, str) and room.startswith("!")]


def state_event(base_url: str, token: str, room_id: str, event_type: str, timeout: float) -> dict[str, Any]:
    room = urllib.parse.quote(room_id, safe="")
    event = urllib.parse.quote(event_type, safe="")
    _status, body = http_json(
        "GET",
        matrix_url(base_url, f"/rooms/{room}/state/{event}"),
        token=token,
        timeout=timeout,
        allow_not_found=True,
    )
    return body


def room_display(base_url: str, token: str, room_id: str, timeout: float) -> dict[str, str]:
    name = state_event(base_url, token, room_id, "m.room.name", timeout).get("name") or ""
    alias = state_event(base_url, token, room_id, "m.room.canonical_alias", timeout).get("alias") or ""
    return {"room_id": room_id, "name": str(name), "alias": str(alias)}


def ensure_joined(base_url: str, token: str, room_id: str, timeout: float) -> None:
    room = urllib.parse.quote(room_id, safe="")
    http_json("POST", matrix_url(base_url, f"/join/{room}"), token=token, payload={}, timeout=timeout)


def send_text(base_url: str, token: str, room_id: str, message: str, timeout: float) -> str:
    room = urllib.parse.quote(room_id, safe="")
    txn_id = f"matrix-check-{int(time.time() * 1000)}-{random.randint(1000, 9999)}"
    path = f"/rooms/{room}/send/m.room.message/{urllib.parse.quote(txn_id, safe='')}"
    _status, body = http_json(
        "PUT",
        matrix_url(base_url, path),
        token=token,
        payload={"msgtype": "m.text", "body": message},
        timeout=timeout,
    )
    event_id = str(body.get("event_id") or "")
    if not event_id:
        raise MatrixCheckError("send_missing_event_id")
    return event_id


def recent_messages(base_url: str, token: str, room_id: str, timeout: float) -> list[dict[str, Any]]:
    room = urllib.parse.quote(room_id, safe="")
    _status, body = http_json(
        "GET",
        matrix_url(base_url, f"/rooms/{room}/messages", {"dir": "b", "limit": "50"}),
        token=token,
        timeout=timeout,
    )
    chunk = body.get("chunk")
    if not isinstance(chunk, list):
        raise MatrixCheckError("messages_response_invalid")
    return [event for event in chunk if isinstance(event, dict)]


def wait_for_message(
    base_url: str,
    token: str,
    room_id: str,
    event_id: str,
    message: str,
    timeout: float,
) -> dict[str, Any]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        for event in recent_messages(base_url, token, room_id, timeout=5.0):
            content = event.get("content") if isinstance(event.get("content"), dict) else {}
            if event.get("event_id") == event_id or content.get("body") == message:
                return event
        time.sleep(0.5)
    raise MatrixCheckError("message_not_visible_to_mbr")


def print_channel_list(channels: list[dict[str, str]], limit: int) -> None:
    shown = channels if limit <= 0 else channels[:limit]
    print(f"drop joined channels: {len(channels)}")
    for item in shown:
        label = item["name"] or item["alias"] or item["room_id"]
        print(f"  - {label} ({item['room_id']})")
    if limit > 0 and len(channels) > limit:
        print(f"  ... {len(channels) - limit} more")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check Matrix drop -> mbr connectivity.")
    parser.add_argument("--env", type=Path, default=DEFAULT_LOCAL_ENV, help="local env file")
    parser.add_argument("--generated-env", type=Path, default=DEFAULT_GENERATED_ENV, help="generated env file with tokens")
    parser.add_argument("--homeserver", default="", help="Matrix homeserver URL")
    parser.add_argument("--namespace", default="", help="Kubernetes namespace for Synapse discovery")
    parser.add_argument("--room-id", default="", help="Room id for drop -> mbr test")
    parser.add_argument("--drop-user", default="", help="drop user localpart or full Matrix user id")
    parser.add_argument("--mbr-user", default="", help="mbr user localpart or full Matrix user id")
    parser.add_argument("--drop-token", default="", help=argparse.SUPPRESS)
    parser.add_argument("--mbr-token", default="", help=argparse.SUPPRESS)
    parser.add_argument("--message", default="", help="message body to send")
    parser.add_argument("--timeout", type=float, default=20.0, help="network/poll timeout seconds")
    parser.add_argument("--list-limit", type=int, default=30, help="number of joined channels to print; 0 means all")
    parser.add_argument("--port-forward-port", type=int, default=18008, help="fallback local port for kubectl port-forward")
    parser.add_argument("--no-port-forward", action="store_true", help="do not fallback to kubectl port-forward")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env = merged_env(args.env, args.generated_env)
    base_url, port_forward = ensure_reachable_homeserver(discover_homeserver(args, env), args, env)
    try:
        drop_auth, mbr_auth = resolve_auth(base_url, env, args)
        room_id = args.room_id or env.get("DY_MATRIX_ROOM_ID", "")
        if not room_id:
            raise MatrixCheckError("room_id_missing")

        drop_rooms = joined_rooms(base_url, drop_auth["token"], args.timeout)
        channel_details = [room_display(base_url, drop_auth["token"], room, args.timeout) for room in drop_rooms]
        print("Matrix connection check")
        print(f"homeserver: {base_url}")
        print(f"drop user: {drop_auth['user_id']}")
        print(f"mbr user: {mbr_auth['user_id']}")
        print(f"test room: {room_id}")
        print_channel_list(channel_details, args.list_limit)

        if room_id not in drop_rooms:
            raise MatrixCheckError("drop_not_joined_test_room")
        try:
            ensure_joined(base_url, mbr_auth["token"], room_id, args.timeout)
        except MatrixCheckError:
            # If already joined, some homeservers can still reject duplicate joins.
            if room_id not in joined_rooms(base_url, mbr_auth["token"], args.timeout):
                raise

        message = args.message or f"matrix connection check {int(time.time())}"
        event_id = send_text(base_url, drop_auth["token"], room_id, message, args.timeout)
        received = wait_for_message(base_url, mbr_auth["token"], room_id, event_id, message, args.timeout)
        sender = str(received.get("sender") or "")

        print(f"sent event: {event_id}")
        print(f"mbr receive: PASS sender={sender} body={message}")
        print("RESULT: PASS")
        return 0
    finally:
        if port_forward is not None:
            try:
                port_forward.terminate()
            except OSError:
                pass


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except MatrixCheckError as exc:
        print(f"RESULT: FAIL {exc}", file=sys.stderr)
        raise SystemExit(1)

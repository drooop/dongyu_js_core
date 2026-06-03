#!/usr/bin/env python3
"""Run real Matrix Chat flows against the configured remote homeserver.

The script uses only the Python standard library, reads deploy/env/local.env by
default, and never prints passwords or access tokens.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
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
DEFAULT_REMOTE_HOMESERVER = "https://matrix.dongyudigital.com"
DEFAULT_REMOTE_SERVER_NAME = "synapse.dongyudigital.com"
ENV_EXPR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::([?-])(.*?))?\}")


class MatrixFlowError(RuntimeError):
    pass


def expand_env_value(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        op = match.group(2) or ""
        arg = match.group(3) or ""
        resolved = os.environ.get(name, "")
        if resolved:
            return resolved
        if op == "-":
            return arg
        if op == "?":
            raise MatrixFlowError(f"env_required:{name}:{arg}")
        return ""

    return ENV_EXPR_RE.sub(replace, value)


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
        if key:
            values[key] = expand_env_value(value.strip().strip("'").strip('"'))
    return values


def merged_env(local_env: Path, generated_env: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    values.update(read_env_file(local_env))
    values.update(read_env_file(generated_env))
    for key, value in os.environ.items():
        if value:
            values[key] = value
    return values


def normalize_base_url(url: str) -> str:
    text = str(url or "").strip()
    return text.rstrip("/") if text else ""


def user_id(localpart: str, server_name: str) -> str:
    text = str(localpart or "").strip()
    if text.startswith("@"):
        return text
    return f"@{text}:{server_name}"


def matrix_url(base_url: str, path: str, query: dict[str, str] | None = None) -> str:
    url = f"{base_url}/_matrix/client/v3{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    return url


def media_url(base_url: str, path: str, query: dict[str, str] | None = None) -> str:
    url = f"{base_url}/_matrix/media/v3{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    return url


def http_json(
    method: str,
    url: str,
    *,
    token: str | None = None,
    payload: dict[str, Any] | None = None,
    body: bytes | None = None,
    content_type: str = "application/json",
    timeout: float = 10.0,
    allow_not_found: bool = False,
) -> tuple[int, dict[str, Any]]:
    data = body
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = content_type
    elif body is not None:
        headers["Content-Type"] = content_type
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return response.status, json.loads(raw or "{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        if allow_not_found and exc.code == 404:
            return exc.code, {}
        raise MatrixFlowError(f"http_{exc.code}:{url}:{raw[:500]}") from exc
    except urllib.error.URLError as exc:
        raise MatrixFlowError(f"url_error:{url}:{exc}") from exc


def login(base_url: str, localpart_or_user_id: str, password: str, timeout: float) -> tuple[str, str]:
    if not password:
        raise MatrixFlowError(f"password_missing:{localpart_or_user_id}")
    _status, body = http_json(
        "POST",
        matrix_url(base_url, "/login"),
        payload={
            "type": "m.login.password",
            "identifier": {"type": "m.id.user", "user": localpart_or_user_id},
            "password": password,
        },
        timeout=timeout,
    )
    token = str(body.get("access_token") or "")
    resolved_user_id = str(body.get("user_id") or "")
    if not token or not resolved_user_id:
        raise MatrixFlowError("matrix_login_missing_token")
    return token, resolved_user_id


def whoami(base_url: str, token: str, timeout: float) -> str:
    _status, body = http_json("GET", matrix_url(base_url, "/account/whoami"), token=token, timeout=timeout)
    resolved = str(body.get("user_id") or "")
    if not resolved:
        raise MatrixFlowError("whoami_missing_user_id")
    return resolved


def resolve_one_auth(
    base_url: str,
    env: dict[str, str],
    *,
    user_key: str,
    password_key: str,
    token_keys: list[str],
    default_localpart: str,
    args_user: str,
    timeout: float,
) -> dict[str, str]:
    server_name = env.get("SYNAPSE_SERVER_NAME", DEFAULT_REMOTE_SERVER_NAME)
    localpart = args_user or env.get(user_key, default_localpart)
    for token_key in token_keys:
        token = str(env.get(token_key, "") or "").strip()
        if not token:
            continue
        try:
            return {"user_id": whoami(base_url, token, timeout), "token": token}
        except MatrixFlowError:
            continue
    token, resolved_user_id = login(base_url, localpart, env.get(password_key, ""), timeout)
    return {"user_id": resolved_user_id or user_id(localpart, server_name), "token": token}


def resolve_auth(base_url: str, env: dict[str, str], args: argparse.Namespace) -> tuple[dict[str, str], dict[str, str]]:
    return (
        resolve_one_auth(
            base_url,
            env,
            user_key="SERVER_USER",
            password_key="SERVER_PASSWORD",
            token_keys=["SERVER_ACCESS_TOKEN", "DROP_ACCESS_TOKEN"],
            default_localpart="drop",
            args_user=args.drop_user,
            timeout=args.timeout,
        ),
        resolve_one_auth(
            base_url,
            env,
            user_key="MBR_USER",
            password_key="MBR_PASSWORD",
            token_keys=["MBR_ACCESS_TOKEN", "MATRIX_MBR_BOT_ACCESS_TOKEN"],
            default_localpart="mbr",
            args_user=args.mbr_user,
            timeout=args.timeout,
        ),
    )


def joined_rooms(base_url: str, token: str, timeout: float) -> set[str]:
    body: dict[str, Any] | None = None
    last_error: MatrixFlowError | None = None
    for attempt in range(3):
        try:
            _status, body = http_json("GET", matrix_url(base_url, "/joined_rooms"), token=token, timeout=timeout)
            break
        except MatrixFlowError as exc:
            last_error = exc
            if "http_500:" not in str(exc) or attempt >= 2:
                raise
            time.sleep(0.5 * (attempt + 1))
    if body is None:
        raise last_error or MatrixFlowError("joined_rooms_failed")
    rooms = body.get("joined_rooms")
    if not isinstance(rooms, list):
        raise MatrixFlowError("joined_rooms_response_invalid")
    return {room for room in rooms if isinstance(room, str) and room.startswith("!")}


def create_room(base_url: str, token: str, name: str, invite: list[str], is_direct: bool, timeout: float) -> str:
    _status, body = http_json(
        "POST",
        matrix_url(base_url, "/createRoom"),
        token=token,
        payload={
            "preset": "trusted_private_chat" if is_direct else "private_chat",
            "name": name,
            "topic": "temporary Matrix Chat real-flow verification room",
            "invite": invite,
            "is_direct": is_direct,
        },
        timeout=timeout,
    )
    room_id = str(body.get("room_id") or "")
    if not room_id.startswith("!"):
        raise MatrixFlowError("create_room_missing_room_id")
    return room_id


def join_room(base_url: str, token: str, room_id: str, timeout: float) -> None:
    room = urllib.parse.quote(room_id, safe="")
    http_json("POST", matrix_url(base_url, f"/join/{room}"), token=token, payload={}, timeout=timeout)


def leave_room(base_url: str, token: str, room_id: str, timeout: float) -> None:
    room = urllib.parse.quote(room_id, safe="")
    http_json("POST", matrix_url(base_url, f"/rooms/{room}/leave"), token=token, payload={}, timeout=timeout)


def kick_member(base_url: str, token: str, room_id: str, user_id_value: str, timeout: float) -> None:
    room = urllib.parse.quote(room_id, safe="")
    http_json(
        "POST",
        matrix_url(base_url, f"/rooms/{room}/kick"),
        token=token,
        payload={"user_id": user_id_value, "reason": "Matrix Chat real-flow verification"},
        timeout=timeout,
    )


def send_message(base_url: str, token: str, room_id: str, content: dict[str, Any], timeout: float) -> str:
    room = urllib.parse.quote(room_id, safe="")
    txn_id = f"matrix-chat-real-flow-{int(time.time() * 1000)}-{random.randint(1000, 9999)}"
    path = f"/rooms/{room}/send/m.room.message/{urllib.parse.quote(txn_id, safe='')}"
    _status, body = http_json("PUT", matrix_url(base_url, path), token=token, payload=content, timeout=timeout)
    event_id = str(body.get("event_id") or "")
    if not event_id:
        raise MatrixFlowError("send_missing_event_id")
    return event_id


def upload_media(base_url: str, token: str, filename: str, content_type: str, body: bytes, timeout: float) -> str:
    _status, data = http_json(
        "POST",
        media_url(base_url, "/upload", {"filename": filename}),
        token=token,
        body=body,
        content_type=content_type,
        timeout=timeout,
    )
    uri = str(data.get("content_uri") or "")
    if not uri.startswith("mxc://"):
        raise MatrixFlowError("upload_missing_content_uri")
    return uri


def recent_messages(base_url: str, token: str, room_id: str, timeout: float) -> list[dict[str, Any]]:
    room = urllib.parse.quote(room_id, safe="")
    _status, body = http_json(
        "GET",
        matrix_url(base_url, f"/rooms/{room}/messages", {"dir": "b", "limit": "80"}),
        token=token,
        timeout=timeout,
    )
    chunk = body.get("chunk")
    if not isinstance(chunk, list):
        raise MatrixFlowError("messages_response_invalid")
    return [event for event in chunk if isinstance(event, dict)]


def get_room_event(base_url: str, token: str, room_id: str, event_id: str, timeout: float) -> dict[str, Any]:
    room = urllib.parse.quote(room_id, safe="")
    event = urllib.parse.quote(event_id, safe="")
    _status, body = http_json("GET", matrix_url(base_url, f"/rooms/{room}/event/{event}"), token=token, timeout=timeout)
    return body


def wait_for_event(base_url: str, token: str, room_id: str, event_id: str, timeout: float) -> dict[str, Any]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            event = get_room_event(base_url, token, room_id, event_id, timeout=5.0)
            if event.get("event_id") == event_id:
                return event
        except MatrixFlowError:
            try:
                for event in recent_messages(base_url, token, room_id, timeout=5.0):
                    if event.get("event_id") == event_id:
                        return event
            except MatrixFlowError:
                pass
        time.sleep(0.5)
    raise MatrixFlowError(f"event_not_visible:{event_id}")


def sync_invites(base_url: str, token: str, timeout: float) -> set[str]:
    filter_body = json.dumps({"room": {"timeline": {"limit": 1}}})
    _status, body = http_json(
        "GET",
        matrix_url(base_url, "/sync", {"timeout": "0", "filter": filter_body}),
        token=token,
        timeout=timeout,
    )
    invite = body.get("rooms", {}).get("invite", {})
    if not isinstance(invite, dict):
        return set()
    return {room_id for room_id in invite if isinstance(room_id, str) and room_id.startswith("!")}


def wait_for_invite(base_url: str, token: str, room_id: str, timeout: float) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if room_id in sync_invites(base_url, token, timeout=5.0):
                return
        except MatrixFlowError:
            pass
        time.sleep(0.5)
    raise MatrixFlowError("drop_invite_not_visible_in_sync")


def cleanup_room(base_url: str, room_id: str, users: list[dict[str, str]], timeout: float) -> None:
    for auth in users:
        try:
            leave_room(base_url, auth["token"], room_id, timeout)
        except Exception as exc:
            if "not in room" in str(exc) or "not a member" in str(exc):
                continue
            user = auth.get("user_id", "unknown")
            print(f"cleanup warning: {user} leave/reject {room_id} failed: {exc}", file=sys.stderr)


def run_flow(base_url: str, drop: dict[str, str], mbr: dict[str, str], args: argparse.Namespace) -> None:
    created_rooms: list[str] = []
    print("Matrix Chat real flow check")
    print(f"homeserver: {base_url}")
    print(f"drop user: {drop['user_id']}")
    print(f"mbr user: {mbr['user_id']}")
    print(f"drop joined channels before: {len(joined_rooms(base_url, drop['token'], args.timeout))}")

    try:
        direct_room = create_room(base_url, drop["token"], f"0401 Direct {int(time.time())}", [mbr["user_id"]], True, args.timeout)
        created_rooms.append(direct_room)
        join_room(base_url, mbr["token"], direct_room, args.timeout)
        text = f"0401 text {int(time.time())}"
        event_id = send_message(base_url, drop["token"], direct_room, {"msgtype": "m.text", "body": text}, args.timeout)
        wait_for_event(base_url, mbr["token"], direct_room, event_id, args.timeout)
        print("text message: PASS")

        uploads = [
            ("file", "0401-note.txt", "text/plain", b"0401 Matrix Chat file card\n", {"msgtype": "m.file"}),
            ("image", "0401-image.png", "image/png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82", {"msgtype": "m.image"}),
            ("audio", "0401-voice.ogg", "audio/ogg", b"OggS\x00\x02matrix-chat-real-flow-audio", {"msgtype": "m.audio"}),
        ]
        for label, filename, mime, body, base_content in uploads:
            uri = upload_media(base_url, drop["token"], filename, mime, body, args.timeout)
            content = {
                **base_content,
                "body": filename,
                "filename": filename,
                "url": uri,
                "info": {"mimetype": mime, "size": len(body)},
            }
            media_event_id = send_message(base_url, drop["token"], direct_room, content, args.timeout)
            seen = wait_for_event(base_url, mbr["token"], direct_room, media_event_id, args.timeout)
            msgtype = seen.get("content", {}).get("msgtype")
            if msgtype != base_content["msgtype"]:
                raise MatrixFlowError(f"{label}_msgtype_mismatch:{msgtype}")
            print(f"{label} message: PASS")

        leave_room(base_url, drop["token"], direct_room, args.timeout)
        if direct_room in joined_rooms(base_url, drop["token"], args.timeout):
            raise MatrixFlowError("drop_still_joined_after_leave")
        print("leave 1v1/direct room: PASS")

        invite_room = create_room(base_url, mbr["token"], f"0401 Invite {int(time.time())}", [drop["user_id"]], False, args.timeout)
        created_rooms.append(invite_room)
        wait_for_invite(base_url, drop["token"], invite_room, args.timeout)
        join_room(base_url, drop["token"], invite_room, args.timeout)
        if invite_room not in joined_rooms(base_url, drop["token"], args.timeout):
            raise MatrixFlowError("drop_not_joined_after_accept")
        invite_event_id = send_message(base_url, drop["token"], invite_room, {"msgtype": "m.text", "body": "0401 accepted invite"}, args.timeout)
        wait_for_event(base_url, mbr["token"], invite_room, invite_event_id, args.timeout)
        print("invite + accept + receive: PASS")

        kick_room = create_room(base_url, drop["token"], f"0401 Kick {int(time.time())}", [mbr["user_id"]], False, args.timeout)
        created_rooms.append(kick_room)
        join_room(base_url, mbr["token"], kick_room, args.timeout)
        kick_member(base_url, drop["token"], kick_room, mbr["user_id"], args.timeout)
        if kick_room in joined_rooms(base_url, mbr["token"], args.timeout):
            raise MatrixFlowError("mbr_still_joined_after_kick")
        print("invite + join + remove member: PASS")

        print("RESULT: PASS")
    finally:
        for room_id in reversed(created_rooms):
            cleanup_room(base_url, room_id, [drop, mbr], args.timeout)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check Matrix Chat real media and membership flows.")
    parser.add_argument("--env", type=Path, default=DEFAULT_LOCAL_ENV, help="local env file")
    parser.add_argument("--generated-env", type=Path, default=DEFAULT_GENERATED_ENV, help="generated env file")
    parser.add_argument("--homeserver", default="", help="Matrix homeserver URL")
    parser.add_argument("--drop-user", default="", help="drop user localpart or full Matrix user id")
    parser.add_argument("--mbr-user", default="", help="mbr user localpart or full Matrix user id")
    parser.add_argument("--timeout", type=float, default=25.0, help="network/poll timeout seconds")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env = merged_env(args.env, args.generated_env)
    base_url = normalize_base_url(args.homeserver or env.get("MATRIX_HOMESERVER_URL", "") or DEFAULT_REMOTE_HOMESERVER)
    if base_url != DEFAULT_REMOTE_HOMESERVER:
        raise MatrixFlowError(f"unexpected_homeserver:{base_url}")
    drop, mbr = resolve_auth(base_url, env, args)
    run_flow(base_url, drop, mbr, args)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except MatrixFlowError as exc:
        print(f"RESULT: FAIL {exc}", file=sys.stderr)
        raise SystemExit(1)

# pyright: reportInvalidTypeForm=false

import os
import uuid
from datetime import datetime
from typing import Optional

import httpx
from fastapi import (
    Body,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
)
from fastapi.responses import FileResponse


SECURED_ROUTES = {
    ("/api/user-plan", "GET"),
    ("/api/usage-status", "GET"),
    ("/api/payment/create-order", "POST"),
    ("/api/payment/verify", "POST"),
    ("/api/generate-study-pack", "POST"),
    ("/api/generate-study-pack-upload", "POST"),
    ("/api/ask-tutor", "POST"),
    ("/api/export-pdf", "POST"),
    ("/api/create-pdf-download", "POST"),
}


def remove_old_insecure_routes(app):
    remaining_routes = []

    for route in app.router.routes:
        route_path = getattr(route, "path", "")
        route_methods = getattr(route, "methods", set()) or set()

        should_remove = any(
            route_path == protected_path
            and protected_method in route_methods
            for protected_path, protected_method in SECURED_ROUTES
        )

        if not should_remove:
            remaining_routes.append(route)

    app.router.routes = remaining_routes
    app.openapi_schema = None


def install_secure_routes(app, core):
    if getattr(
        app.state,
        "vidgen_secure_routes_installed",
        False,
    ):
        return

    remove_old_insecure_routes(app)

    safe_client_id = core["safe_client_id"]
    normalize_plan = core["normalize_plan"]
    get_plan_limit_hours = core["get_plan_limit_hours"]

    load_usage_store = core["load_usage_store"]
    save_usage_store = core["save_usage_store"]
    usage_lock = core["usage_lock"]

    load_payment_store = core["load_payment_store"]
    save_payment_store = core["save_payment_store"]
    payment_lock = core["payment_lock"]

    get_saved_plan_for_client = core[
        "get_saved_plan_for_client"
    ]

    resolve_effective_plan = core[
        "resolve_effective_plan"
    ]

    get_usage_status_data = core[
        "get_usage_status_data"
    ]

    check_usage_limit_or_raise = core[
        "check_usage_limit_or_raise"
    ]

    record_usage_hours = core[
        "record_usage_hours"
    ]

    get_razorpay_client = core[
        "get_razorpay_client"
    ]

    verify_razorpay_signature = core[
        "verify_razorpay_signature"
    ]

    save_created_payment_order = core[
        "save_created_payment_order"
    ]

    mark_payment_success = core[
        "mark_payment_success"
    ]

    fetch_youtube_duration_hours = core[
        "fetch_youtube_duration_hours"
    ]

    build_multimodal_study_pack = core[
        "build_multimodal_study_pack"
    ]

    save_uploaded_video = core[
        "save_uploaded_video"
    ]

    build_uploaded_video_study_pack = core[
        "build_uploaded_video_study_pack"
    ]

    ask_ai_tutor = core["ask_ai_tutor"]
    create_pdf_file = core["create_pdf_file"]
    get_today_key = core["get_today_key"]

    ExportPDFRequest = core["ExportPDFRequest"]

    PLAN_PAYMENT_DETAILS = core[
        "PLAN_PAYMENT_DETAILS"
    ]

    RAZORPAY_KEY_ID = core[
        "RAZORPAY_KEY_ID"
    ]

    supabase_url = os.getenv(
        "SUPABASE_URL",
        "",
    ).strip().rstrip("/")

    supabase_publishable_key = (
        os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip()

    def migrate_legacy_identity(
        legacy_client_id: str,
        authenticated_user_id: str,
    ) -> bool:
        legacy_id = safe_client_id(
            legacy_client_id
        )

        user_id = safe_client_id(
            authenticated_user_id
        )

        if not legacy_id:
            return False

        if legacy_id == "anonymous":
            return False

        if legacy_id == user_id:
            return False

        if not legacy_id.startswith("vidgen_"):
            return False

        migrated_plan = False
        migrated_usage = False
        legacy_data_found = False

        plan_rank = {
            "Free": 0,
            "Go": 1,
            "Pro": 2,
        }

        with payment_lock:
            payment_store = load_payment_store()

            payment_store.setdefault(
                "orders",
                {},
            )

            payment_store.setdefault(
                "plans",
                {},
            )

            payment_store.setdefault(
                "migrations",
                {},
            )

            existing_owner = payment_store[
                "migrations"
            ].get(legacy_id)

            if (
                existing_owner
                and existing_owner != user_id
            ):
                return False

            legacy_plan_data = payment_store[
                "plans"
            ].get(legacy_id)

            current_plan_data = payment_store[
                "plans"
            ].get(user_id, {})

            payment_changed = False

            if isinstance(
                legacy_plan_data,
                dict,
            ):
                legacy_data_found = True

                legacy_plan = normalize_plan(
                    legacy_plan_data.get(
                        "plan",
                        "Free",
                    )
                )

                current_plan = normalize_plan(
                    current_plan_data.get(
                        "plan",
                        "Free",
                    )
                )

                if (
                    plan_rank[legacy_plan]
                    > plan_rank[current_plan]
                ):
                    migrated_plan_data = dict(
                        legacy_plan_data
                    )

                    migrated_plan_data[
                        "plan"
                    ] = legacy_plan

                    migrated_plan_data[
                        "migrated_from"
                    ] = legacy_id

                    migrated_plan_data[
                        "migrated_at"
                    ] = datetime.now().strftime(
                        "%Y-%m-%d %H:%M:%S"
                    )

                    payment_store["plans"][
                        user_id
                    ] = migrated_plan_data

                    migrated_plan = True
                    payment_changed = True

                payment_store["plans"].pop(
                    legacy_id,
                    None,
                )

                payment_changed = True

            for order_id, order_data in list(
                payment_store["orders"].items()
            ):
                if not isinstance(
                    order_data,
                    dict,
                ):
                    continue

                if (
                    order_data.get("client_id")
                    != legacy_id
                ):
                    continue

                legacy_data_found = True

                updated_order = dict(
                    order_data
                )

                updated_order[
                    "client_id"
                ] = user_id

                updated_order[
                    "migrated_from"
                ] = legacy_id

                updated_order[
                    "migrated_at"
                ] = datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S"
                )

                payment_store["orders"][
                    order_id
                ] = updated_order

                payment_changed = True

            if legacy_data_found:
                payment_store[
                    "migrations"
                ][legacy_id] = user_id

                payment_changed = True

            if payment_changed:
                save_payment_store(
                    payment_store
                )

        with usage_lock:
            usage_store = load_usage_store()

            legacy_usage = usage_store.get(
                legacy_id
            )

            if isinstance(
                legacy_usage,
                dict,
            ):
                legacy_data_found = True

                today = get_today_key()

                current_usage = usage_store.get(
                    user_id,
                    {},
                )

                legacy_is_today = (
                    legacy_usage.get("date")
                    == today
                )

                current_is_today = (
                    current_usage.get("date")
                    == today
                )

                if legacy_is_today:
                    legacy_used = float(
                        legacy_usage.get(
                            "used_hours",
                            0.0,
                        )
                    )

                    current_used = (
                        float(
                            current_usage.get(
                                "used_hours",
                                0.0,
                            )
                        )
                        if current_is_today
                        else 0.0
                    )

                    if (
                        not current_is_today
                        or legacy_used
                        > current_used
                    ):
                        migrated_usage_data = dict(
                            legacy_usage
                        )

                        migrated_usage_data[
                            "migrated_from"
                        ] = legacy_id

                        migrated_usage_data[
                            "migrated_at"
                        ] = datetime.now().strftime(
                            "%Y-%m-%d %H:%M:%S"
                        )

                        usage_store[
                            user_id
                        ] = migrated_usage_data

                        migrated_usage = True

                usage_store.pop(
                    legacy_id,
                    None,
                )

                save_usage_store(
                    usage_store
                )

        if legacy_data_found:
            with payment_lock:
                payment_store = (
                    load_payment_store()
                )

                payment_store.setdefault(
                    "migrations",
                    {},
                )

                owner = payment_store[
                    "migrations"
                ].get(legacy_id)

                if not owner:
                    payment_store[
                        "migrations"
                    ][legacy_id] = user_id

                    save_payment_store(
                        payment_store
                    )

        return (
            migrated_plan
            or migrated_usage
        )

    async def require_authenticated_user(
        authorization: Optional[str] = Header(
            default=None
        ),
        legacy_client_id: Optional[str] = Header(
            default=None,
            alias="X-Vidgen-Legacy-Client-Id",
        ),
    ):
        if not supabase_url:
            raise HTTPException(
                status_code=500,
                detail=(
                    "SUPABASE_URL is missing in "
                    "backend/.env."
                ),
            )

        if not supabase_publishable_key:
            raise HTTPException(
                status_code=500,
                detail=(
                    "SUPABASE_PUBLISHABLE_KEY is "
                    "missing in backend/.env."
                ),
            )

        if not authorization:
            raise HTTPException(
                status_code=401,
                detail=(
                    "Authentication required. "
                    "Please log in to VidGen AI."
                ),
                headers={
                    "WWW-Authenticate": "Bearer"
                },
            )

        scheme, separator, token = (
            authorization.partition(" ")
        )

        if not separator:
            raise HTTPException(
                status_code=401,
                detail=(
                    "Invalid authentication header."
                ),
                headers={
                    "WWW-Authenticate": "Bearer"
                },
            )

        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=401,
                detail=(
                    "Bearer authentication is required."
                ),
                headers={
                    "WWW-Authenticate": "Bearer"
                },
            )

        access_token = token.strip()

        if not access_token:
            raise HTTPException(
                status_code=401,
                detail=(
                    "Supabase access token is missing."
                ),
                headers={
                    "WWW-Authenticate": "Bearer"
                },
            )

        authentication_url = (
            f"{supabase_url}/auth/v1/user"
        )

        request_headers = {
            "apikey": supabase_publishable_key,
            "Authorization": (
                f"Bearer {access_token}"
            ),
        }

        try:
            async with httpx.AsyncClient(
                timeout=20.0
            ) as client:
                response = await client.get(
                    authentication_url,
                    headers=request_headers,
                )

        except httpx.RequestError as error:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Could not connect to Supabase "
                    f"authentication. Reason: {error}"
                ),
            )

        if response.status_code in {
            401,
            403,
        }:
            raise HTTPException(
                status_code=401,
                detail=(
                    "Your Supabase login session is "
                    "invalid or expired. Please log "
                    "in again."
                ),
                headers={
                    "WWW-Authenticate": "Bearer"
                },
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Supabase could not verify "
                    "the current login session."
                ),
            )

        try:
            user_data = response.json()
        except Exception:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Supabase returned an invalid "
                    "authentication response."
                ),
            )

        raw_user_id = str(
            user_data.get("id") or ""
        ).strip()

        if not raw_user_id:
            raise HTTPException(
                status_code=401,
                detail=(
                    "Authenticated Supabase user ID "
                    "was not found."
                ),
                headers={
                    "WWW-Authenticate": "Bearer"
                },
            )

        user_id = safe_client_id(
            raw_user_id
        )

        legacy_migrated = False

        if legacy_client_id:
            legacy_migrated = (
                migrate_legacy_identity(
                    legacy_client_id=(
                        legacy_client_id
                    ),
                    authenticated_user_id=(
                        user_id
                    ),
                )
            )

        return {
            "user_id": user_id,
            "email": str(
                user_data.get("email") or ""
            ),
            "user": user_data,
            "legacy_migrated": (
                legacy_migrated
            ),
        }

    @app.get("/api/auth-check")
    async def auth_check(
        identity=Depends(
            require_authenticated_user
        ),
    ):
        return {
            "success": True,
            "authenticated": True,
            "user_id": identity["user_id"],
            "email": identity["email"],
            "legacy_migrated": identity[
                "legacy_migrated"
            ],
        }

    @app.get("/api/user-plan")
    async def user_plan(
        identity=Depends(
            require_authenticated_user
        ),
    ):
        user_id = identity["user_id"]

        plan = get_saved_plan_for_client(
            user_id
        )

        return {
            "success": True,
            "user_id": user_id,
            "client_id": user_id,
            "plan": plan,
            "limit_hours": (
                get_plan_limit_hours(plan)
            ),
            "legacy_migrated": identity[
                "legacy_migrated"
            ],
        }

    @app.get("/api/usage-status")
    async def usage_status(
        identity=Depends(
            require_authenticated_user
        ),
    ):
        user_id = identity["user_id"]

        effective_plan = (
            resolve_effective_plan(
                user_id,
                "Free",
            )
        )

        status = get_usage_status_data(
            user_id,
            effective_plan,
        )

        return {
            "success": True,
            "user_id": user_id,
            "usage_status": status,
        }

    @app.post(
        "/api/payment/create-order"
    )
    async def create_payment_order(
        payload: dict = Body(...),
        identity=Depends(
            require_authenticated_user
        ),
    ):
        user_id = identity["user_id"]

        plan = normalize_plan(
            payload.get("plan")
        )

        if plan not in ["Go", "Pro"]:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only Go and Pro plans "
                    "require payment."
                ),
            )

        payment_details = (
            PLAN_PAYMENT_DETAILS[plan]
        )

        amount = payment_details["amount"]

        razorpay_client = (
            get_razorpay_client()
        )

        receipt_id = (
            f"vidgen_{uuid.uuid4().hex[:24]}"
        )

        try:
            order = (
                razorpay_client.order.create(
                    {
                        "amount": amount,
                        "currency": "INR",
                        "receipt": receipt_id,
                        "notes": {
                            "product": (
                                "VidGen AI"
                            ),
                            "plan": plan,
                            "user_id": user_id,
                        },
                    }
                )
            )

        except Exception as error:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Could not create Razorpay "
                    f"order. Reason: {error}"
                ),
            )

        save_created_payment_order(
            order_id=order["id"],
            client_id=user_id,
            plan=plan,
            amount=amount,
        )

        return {
            "success": True,
            "key_id": RAZORPAY_KEY_ID,
            "order_id": order["id"],
            "amount": amount,
            "currency": "INR",
            "plan": plan,
            "display_amount": (
                payment_details[
                    "display_amount"
                ]
            ),
            "hours": payment_details[
                "hours"
            ],
        }

    @app.post("/api/payment/verify")
    async def verify_payment(
        payload: dict = Body(...),
        identity=Depends(
            require_authenticated_user
        ),
    ):
        user_id = identity["user_id"]

        plan = normalize_plan(
            payload.get("plan")
        )

        if plan not in ["Go", "Pro"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid paid plan.",
            )

        order_id = str(
            payload.get(
                "razorpay_order_id"
            )
            or ""
        ).strip()

        payment_id = str(
            payload.get(
                "razorpay_payment_id"
            )
            or ""
        ).strip()

        signature = str(
            payload.get(
                "razorpay_signature"
            )
            or ""
        ).strip()

        if not order_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Razorpay order ID is missing."
                ),
            )

        if not payment_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Razorpay payment ID is missing."
                ),
            )

        if not signature:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Razorpay signature is missing."
                ),
            )

        signature_valid = (
            verify_razorpay_signature(
                order_id=order_id,
                payment_id=payment_id,
                signature=signature,
            )
        )

        if not signature_valid:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid Razorpay payment "
                    "signature."
                ),
            )

        updated_plan = (
            mark_payment_success(
                order_id=order_id,
                payment_id=payment_id,
                client_id=user_id,
                plan=plan,
            )
        )

        return {
            "success": True,
            "message": (
                f"{updated_plan} plan "
                "activated successfully."
            ),
            "plan": updated_plan,
            "limit_hours": (
                get_plan_limit_hours(
                    updated_plan
                )
            ),
            "user_id": user_id,
        }

    @app.post(
        "/api/generate-study-pack"
    )
    async def generate_study_pack(
        payload: dict = Body(...),
        identity=Depends(
            require_authenticated_user
        ),
    ):
        user_id = identity["user_id"]

        video_url = str(
            payload.get("video_url") or ""
        ).strip()

        topic = str(
            payload.get("topic")
            or "Uploaded Lecture"
        ).strip()

        if not video_url:
            raise HTTPException(
                status_code=400,
                detail=(
                    "YouTube video URL is required."
                ),
            )

        effective_plan = (
            resolve_effective_plan(
                user_id,
                "Free",
            )
        )

        (
            duration_hours,
            youtube_metadata_data,
        ) = fetch_youtube_duration_hours(
            video_url
        )

        check_usage_limit_or_raise(
            client_id=user_id,
            plan=effective_plan,
            requested_hours=duration_hours,
        )

        detected_title = (
            youtube_metadata_data.get(
                "title"
            )
            or topic
            or "Uploaded Lecture"
        )

        study_pack = (
            build_multimodal_study_pack(
                topic=detected_title,
                video_url=video_url,
            )
        )

        usage_status_data = (
            record_usage_hours(
                client_id=user_id,
                plan=effective_plan,
                charged_hours=duration_hours,
                source="youtube",
            )
        )

        study_pack[
            "youtube_metadata"
        ] = youtube_metadata_data

        study_pack[
            "charged_hours"
        ] = round(duration_hours, 3)

        study_pack[
            "usage_status"
        ] = usage_status_data

        return {
            "success": True,
            "message": (
                "Multimodal video AI study pack "
                "generated successfully."
            ),
            "charged_hours": round(
                duration_hours,
                3,
            ),
            "usage_status": (
                usage_status_data
            ),
            "study_pack": study_pack,
        }

    @app.post(
        "/api/generate-study-pack-upload"
    )
    async def generate_study_pack_upload(
        video_file: UploadFile = File(...),
        topic: str = Form(
            "Uploaded Lecture"
        ),
        account_type: str = Form(
            "student"
        ),
        plan: str = Form("free"),
        video_duration_hours: float = Form(
            1.0
        ),
        identity=Depends(
            require_authenticated_user
        ),
    ):
        del account_type
        del plan

        user_id = identity["user_id"]
        temp_path = None

        charged_hours = max(
            float(
                video_duration_hours or 1.0
            ),
            1 / 60,
        )

        effective_plan = (
            resolve_effective_plan(
                user_id,
                "Free",
            )
        )

        check_usage_limit_or_raise(
            client_id=user_id,
            plan=effective_plan,
            requested_hours=charged_hours,
        )

        try:
            (
                temp_path,
                mime_type,
            ) = await save_uploaded_video(
                video_file
            )

            study_pack = (
                build_uploaded_video_study_pack(
                    topic=topic,
                    file_path=temp_path,
                    mime_type=mime_type,
                )
            )

            usage_status_data = (
                record_usage_hours(
                    client_id=user_id,
                    plan=effective_plan,
                    charged_hours=(
                        charged_hours
                    ),
                    source="upload",
                )
            )

            study_pack[
                "charged_hours"
            ] = round(
                charged_hours,
                3,
            )

            study_pack[
                "usage_status"
            ] = usage_status_data

            return {
                "success": True,
                "message": (
                    "Uploaded video AI study "
                    "pack generated successfully."
                ),
                "charged_hours": round(
                    charged_hours,
                    3,
                ),
                "usage_status": (
                    usage_status_data
                ),
                "study_pack": study_pack,
            }

        finally:
            if (
                temp_path
                and os.path.exists(
                    temp_path
                )
            ):
                try:
                    os.remove(
                        temp_path
                    )
                except Exception:
                    pass

    @app.post("/api/ask-tutor")
    async def ask_tutor(
        payload: dict = Body(...),
        identity=Depends(
            require_authenticated_user
        ),
    ):
        del identity

        question = str(
            payload.get("question") or ""
        ).strip()

        topic = str(
            payload.get("topic")
            or "Lecture Topic"
        ).strip()

        notes = payload.get("notes") or []

        if not isinstance(notes, list):
            notes = []

        if not question:
            raise HTTPException(
                status_code=400,
                detail="Question is required.",
            )

        answer = ask_ai_tutor(
            question=question,
            topic=topic,
            notes=notes,
        )

        return {
            "success": True,
            "topic": topic,
            "question": question,
            "answer": answer,
        }

    @app.post("/api/export-pdf")
    async def export_pdf(
        payload: dict = Body(...),
        identity=Depends(
            require_authenticated_user
        ),
    ):
        del identity

        try:
            export_request = (
                ExportPDFRequest(**payload)
            )
        except Exception as error:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Invalid PDF export data. "
                    f"Reason: {error}"
                ),
            )

        file_name, file_path = (
            create_pdf_file(
                export_request
            )
        )

        return FileResponse(
            file_path,
            media_type="application/pdf",
            filename=file_name,
        )

    @app.post(
        "/api/create-pdf-download"
    )
    async def create_pdf_download(
        payload: dict = Body(...),
        identity=Depends(
            require_authenticated_user
        ),
    ):
        del identity

        try:
            export_request = (
                ExportPDFRequest(**payload)
            )
        except Exception as error:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Invalid PDF export data. "
                    f"Reason: {error}"
                ),
            )

        file_name, _ = create_pdf_file(
            export_request
        )

        return {
            "success": True,
            "file_name": file_name,
            "download_url": (
                f"/api/download-pdf/"
                f"{file_name}"
            ),
        }

    app.state.vidgen_secure_routes_installed = (
        True
    )

    app.openapi_schema = None
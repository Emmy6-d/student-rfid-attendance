from datetime import datetime, timezone

from app.database import supabase
from app.schemas.rfid import (
    RFIDAssign,
    RFIDEnrollmentCreate,
    RFIDEnrollmentScan,
    RFIDUpdate,
)


def get_all_rfid_cards():
    response = (
        supabase
        .table("rfid_cards")
        .select(
            "*, students(student_id, first_name, last_name, class_name)"
        )
        .order("created_at", desc=True)
        .execute()
    )

    return response.data


def get_rfid_card(rfid_id: str):

    response = (
        supabase
        .table("rfid_cards")
        .select(
            "*, students(student_id, first_name, last_name, class_name)"
        )
        .eq("id", rfid_id)
        .execute()
    )

    if not response.data:
        return None

    return response.data[0]


def get_rfid_by_uid(uid: str):

    response = (
        supabase
        .table("rfid_cards")
        .select("*")
        .eq("uid", uid)
        .execute()
    )

    if not response.data:
        return None

    return response.data[0]


def assign_rfid(data: RFIDAssign):

    # -----------------------------------------
    # 1. Check that the student exists
    # -----------------------------------------

    uid = data.uid.strip().upper()
    if not uid:
        return {
            "success": False,
            "status": "invalid_uid",
            "message": "RFID UID is empty"
        }

    student_response = (
        supabase
        .table("students")
        .select("*")
        .eq("id", data.student_id)
        .execute()
    )

    if not student_response.data:
        return {
            "success": False,
            "status": "student_not_found",
            "message": "Student does not exist"
        }

    student = student_response.data[0]

    # -----------------------------------------
    # 2. Check that the student is active
    # -----------------------------------------

    if not student["status"]:
        return {
            "success": False,
            "status": "student_inactive",
            "message": "Student is inactive"
        }

    # -----------------------------------------
    # 3. Check whether UID already exists
    # -----------------------------------------

    existing_card = get_rfid_by_uid(uid)

    if existing_card:

        # Same UID already belongs to this student
        if (
            existing_card["student_id"] == data.student_id
            and existing_card["active"]
        ):
            return {
                "success": False,
                "status": "already_assigned",
                "message": "This RFID card is already assigned to this student"
            }

        # UID belongs to another student
        if existing_card["student_id"] != data.student_id:
            return {
                "success": False,
                "status": "uid_already_assigned",
                "message": "This RFID UID is already assigned to another student"
            }

        # UID exists but is inactive for the same student.
        # We can reactivate it instead of creating a duplicate.
        if existing_card["student_id"] == data.student_id:

            supabase \
                .table("rfid_cards") \
                .update({"active": False}) \
                .eq("student_id", data.student_id) \
                .eq("active", True) \
                .execute()

            response = (
                supabase
                .table("rfid_cards")
                .update({"active": True})
                .eq("id", existing_card["id"])
                .execute()
            )

            return {
                "success": True,
                "status": "rfid_reactivated",
                "message": "Existing RFID card has been reactivated",
                "rfid": response.data[0]
            }

    # -----------------------------------------
    # 4. Deactivate existing active card
    #    belonging to this student
    # -----------------------------------------

    supabase \
        .table("rfid_cards") \
        .update({"active": False}) \
        .eq("student_id", data.student_id) \
        .eq("active", True) \
        .execute()

    # -----------------------------------------
    # 5. Create new RFID assignment
    # -----------------------------------------

    new_card = {
        "uid": uid,
        "student_id": data.student_id,
        "active": True
    }

    response = (
        supabase
        .table("rfid_cards")
        .insert(new_card)
        .execute()
    )

    return {
        "success": True,
        "status": "rfid_assigned",
        "message": "RFID card assigned successfully",
        "rfid": response.data[0]
    }


def update_rfid(
    rfid_id: str,
    data: RFIDUpdate
):

    update_data = data.model_dump(
        exclude_none=True
    )

    if not update_data:
        return None

    if update_data.get("active") is True:
        card_response = (
            supabase
            .table("rfid_cards")
            .select("student_id")
            .eq("id", rfid_id)
            .execute()
        )

        if not card_response.data:
            return None

        supabase \
            .table("rfid_cards") \
            .update({"active": False}) \
            .eq("student_id", card_response.data[0]["student_id"]) \
            .eq("active", True) \
            .execute()

    response = (
        supabase
        .table("rfid_cards")
        .update(update_data)
        .eq("id", rfid_id)
        .execute()
    )

    if not response.data:
        return None

    return response.data[0]


def delete_rfid(rfid_id: str):

    response = (
        supabase
        .table("rfid_cards")
        .delete()
        .eq("id", rfid_id)
        .execute()
    )

    if not response.data:
        return None

    return response.data[0]


def _enrollment_response(row: dict):
    student = row.get("students") or {}
    return {
        "id": row["id"],
        "status": row["status"],
        "student_uuid": row["student_id"],
        "student_id": student.get("student_id", ""),
        "student_name": (
            f"{student.get('first_name', '')} {student.get('last_name', '')}"
        ).strip(),
        "card_uid": row.get("card_uid"),
        "last_scanned_uid": row.get("last_scanned_uid"),
        "last_error": row.get("last_error"),
        "device_id": row.get("device_id"),
        "created_at": row.get("created_at"),
        "completed_at": row.get("completed_at"),
    }


def create_enrollment_request(data: RFIDEnrollmentCreate):
    student_response = (
        supabase
        .table("students")
        .select("id, student_id, first_name, last_name, status")
        .eq("id", data.student_id)
        .execute()
    )

    if not student_response.data:
        return {"success": False, "status": "student_not_found", "message": "Student does not exist"}

    student = student_response.data[0]
    if not student["status"]:
        return {"success": False, "status": "student_inactive", "message": "Student is inactive"}

    pending_response = (
        supabase
        .table("rfid_enrollment_requests")
        .select("*")
        .eq("student_id", data.student_id)
        .eq("status", "pending")
        .limit(1)
        .execute()
    )

    if pending_response.data:
        request = pending_response.data[0]
    else:
        insert_response = (
            supabase
            .table("rfid_enrollment_requests")
            .insert({"student_id": data.student_id})
            .execute()
        )
        if not insert_response.data:
            return {"success": False, "status": "request_failed", "message": "Could not start card enrollment"}
        request = insert_response.data[0]

    return {
        "success": True,
        **_enrollment_response({**request, "students": student}),
    }


def get_enrollment_request(request_id: str):
    response = (
        supabase
        .table("rfid_enrollment_requests")
        .select("*, students(student_id, first_name, last_name)")
        .eq("id", request_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        return None

    return _enrollment_response(response.data[0])


def get_pending_enrollment_request():
    response = (
        supabase
        .table("rfid_enrollment_requests")
        .select("*, students(student_id, first_name, last_name)")
        .eq("status", "pending")
        .order("created_at")
        .limit(1)
        .execute()
    )

    if not response.data:
        return {"pending": False}

    return {"pending": True, **_enrollment_response(response.data[0])}


def cancel_enrollment_request(request_id: str):
    response = (
        supabase
        .table("rfid_enrollment_requests")
        .update({"status": "cancelled"})
        .eq("id", request_id)
        .eq("status", "pending")
        .execute()
    )

    if not response.data:
        return None

    return {"success": True, "status": "cancelled", "id": request_id}


def complete_enrollment_request(request_id: str, data: RFIDEnrollmentScan):
    request = get_enrollment_request(request_id)
    if not request:
        return {"success": False, "status": "request_not_found", "message": "Enrollment request not found"}

    if request["status"] == "completed":
        return {
            "success": True,
            "status": "card_assigned",
            "message": "Card is already assigned",
            **request,
        }

    if request["status"] != "pending":
        return {"success": False, "status": "request_not_pending", "message": "Enrollment request is no longer pending"}

    uid = data.uid.strip().upper()
    if not uid:
        return {"success": False, "status": "invalid_uid", "message": "RFID UID is empty"}

    scan_response = (
        supabase
        .table("rfid_enrollment_requests")
        .update({
            "last_scanned_uid": uid,
            "device_id": data.device_id,
            "last_error": None,
        })
        .eq("id", request_id)
        .eq("status", "pending")
        .execute()
    )

    if not scan_response.data:
        return {"success": False, "status": "request_not_pending", "message": "Enrollment request is no longer pending"}

    assigned = assign_rfid(RFIDAssign(uid=uid, student_id=request["student_uuid"]))
    if not assigned["success"] and assigned["status"] != "already_assigned":
        supabase \
            .table("rfid_enrollment_requests") \
            .update({"last_error": assigned["message"], "device_id": data.device_id}) \
            .eq("id", request_id) \
            .eq("status", "pending") \
            .execute()
        return assigned

    if assigned["status"] == "already_assigned":
        existing_card = get_rfid_by_uid(uid)
        if not existing_card or existing_card["student_id"] != request["student_uuid"] or not existing_card["active"]:
            return assigned
        card = existing_card
    else:
        card = assigned["rfid"]

    completed_at = datetime.now(timezone.utc).isoformat()
    update_response = (
        supabase
        .table("rfid_enrollment_requests")
        .update({
            "status": "completed",
            "rfid_card_id": card["id"],
            "card_uid": uid,
            "device_id": data.device_id,
            "last_error": None,
            "completed_at": completed_at,
        })
        .eq("id", request_id)
        .eq("status", "pending")
        .execute()
    )

    if not update_response.data:
        current_request = get_enrollment_request(request_id)
        if current_request and current_request["status"] == "completed":
            return {"success": True, "status": "card_assigned", "message": "Card is already assigned", **current_request}
        return {"success": False, "status": "request_not_pending", "message": "Enrollment request is no longer pending"}

    return {
        "success": True,
        "status": "card_assigned",
        "message": "RFID card assigned successfully",
        "id": request_id,
        "student_id": request["student_id"],
        "student_name": request["student_name"],
        "card_uid": uid,
        "device_id": data.device_id,
        "completed_at": completed_at,
    }
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


RWANDA_TIMEZONE = ZoneInfo("Africa/Kigali")

from app.database import supabase
from app.schemas.attendance import AttendanceScan


def process_attendance_scan(data: AttendanceScan):

    # ==========================================================
    # 1. NORMALIZE RFID UID
    # ==========================================================

    uid = data.uid.strip().upper()

    if not uid:
        return {
            "success": False,
            "status": "invalid_uid",
            "message": "RFID UID is empty"
        }

    # ==========================================================
    # 2. FIND RFID CARD
    # ==========================================================

    rfid_response = (
        supabase
        .table("rfid_cards")
        .select("*")
        .eq("uid", uid)
        .execute()
    )

    if not rfid_response.data:

        return {
            "success": False,
            "status": "card_not_registered",
            "message": "RFID card is not registered"
        }

    rfid_card = rfid_response.data[0]

    # ==========================================================
    # 3. CHECK WHETHER RFID CARD IS ACTIVE
    # ==========================================================

    if not rfid_card["active"]:

        return {
            "success": False,
            "status": "card_inactive",
            "message": "RFID card is inactive"
        }

    # ==========================================================
    # 4. GET STUDENT
    # ==========================================================

    student_response = (
        supabase
        .table("students")
        .select("*")
        .eq("id", rfid_card["student_id"])
        .execute()
    )

    if not student_response.data:

        return {
            "success": False,
            "status": "student_not_found",
            "message": "Student associated with RFID card was not found"
        }

    student = student_response.data[0]

    # ==========================================================
    # 5. CHECK WHETHER STUDENT IS ACTIVE
    # ==========================================================

    if not student["status"]:

        return {
            "success": False,
            "status": "student_inactive",
            "message": "Student is inactive"
        }

    # ==========================================================
    # 6. DETERMINE TODAY'S DATE
    # ==========================================================

    now = datetime.now(timezone.utc)

    rwanda_now = now.astimezone(RWANDA_TIMEZONE)

    today = rwanda_now.date().isoformat()


    # ==========================================================
    # 7. CHECK WHETHER STUDENT ALREADY ATTENDED TODAY
    # ==========================================================

    attendance_response = (
        supabase
        .table("attendance")
        .select("*")
        .eq("student_id", student["id"])
        .eq("attendance_date", today)
        .execute()
    )

    if attendance_response.data:

        existing_attendance = attendance_response.data[0]

        return {
            "success": True,
            "status": "already_recorded",
            "message": "Attendance already recorded today",
            "student_id": student["student_id"],
            "student_name": (
                f"{student['first_name']} "
                f"{student['last_name']}"
            ),
            "attendance_id": existing_attendance["id"],
            "scanned_at": existing_attendance["scanned_at"]
        }

    # ==========================================================
    # 8. CREATE ATTENDANCE RECORD
    # ==========================================================

    attendance_data = {
        "student_id": student["id"],
        "rfid_card_id": rfid_card["id"],
        "scanned_at": now.isoformat(),
        "attendance_date": today,
        "device_id": data.device_id,
        "status": "present"
    }

    insert_response = (
        supabase
        .table("attendance")
        .insert(attendance_data)
        .execute()
    )

    # ==========================================================
    # 9. VERIFY INSERT
    # ==========================================================

    if not insert_response.data:

        return {
            "success": False,
            "status": "attendance_failed",
            "message": "Attendance could not be recorded"
        }

    attendance = insert_response.data[0]

    # ==========================================================
    # 10. SUCCESS RESPONSE
    # ==========================================================

    return {
        "success": True,
        "status": "attendance_recorded",
        "message": "Attendance recorded successfully",
        "student_id": student["student_id"],
        "student_name": (
            f"{student['first_name']} "
            f"{student['last_name']}"
        ),
        "attendance_id": attendance["id"],
        "scanned_at": attendance["scanned_at"]
    }



def get_attendance_records(
    attendance_date: str | None = None,
    limit: int = 50,
    offset: int = 0
):
    """
    Get attendance records.

    If attendance_date is not provided, all attendance
    records are returned according to the limit/offset.
    """

    query = (
        supabase
        .table("attendance")
        .select(
            """
            *,
            students(
                student_id,
                first_name,
                last_name,
                class_name
            ),
            rfid_cards(
                uid
            )
            """
        )
        .order("scanned_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if attendance_date:
        query = query.eq("attendance_date", attendance_date)

    response = query.execute()

    records = []

    for row in response.data:
        student = row.get("students") or {}
        rfid_card = row.get("rfid_cards") or {}

        records.append(
            {
                "id": row["id"],
                "student_uuid": row["student_id"],
                "student_id": student.get("student_id", ""),
                "student_name": (
                    f"{student.get('first_name', '')} "
                    f"{student.get('last_name', '')}"
                ).strip(),
                "class_name": student.get("class_name"),
                "rfid_uid": rfid_card.get("uid", ""),
                "scanned_at": row["scanned_at"],
                "attendance_date": row["attendance_date"],
                "device_id": row.get("device_id"),
                "status": row["status"],
            }
        )

    return records


def get_today_attendance():
    """
    Get all attendance records for today in Rwanda.
    """

    now = datetime.now(RWANDA_TIMEZONE)

    today = now.date().isoformat()

    return get_attendance_records(
        attendance_date=today,
        limit=100,
        offset=0
    )


def get_student_attendance_history(
    student_uuid: str,
    limit: int = 100,
    offset: int = 0
):
    """
    Get attendance history for one student.
    """

    query = (
        supabase
        .table("attendance")
        .select(
            """
            *,
            students(
                student_id,
                first_name,
                last_name,
                class_name
            ),
            rfid_cards(
                uid
            )
            """
        )
        .eq("student_id", student_uuid)
        .order("scanned_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    response = query.execute()

    records = []

    for row in response.data:
        student = row.get("students") or {}
        rfid_card = row.get("rfid_cards") or {}

        records.append(
            {
                "id": row["id"],
                "student_uuid": row["student_id"],
                "student_id": student.get("student_id", ""),
                "student_name": (
                    f"{student.get('first_name', '')} "
                    f"{student.get('last_name', '')}"
                ).strip(),
                "class_name": student.get("class_name"),
                "rfid_uid": rfid_card.get("uid", ""),
                "scanned_at": row["scanned_at"],
                "attendance_date": row["attendance_date"],
                "device_id": row.get("device_id"),
                "status": row["status"],
            }
        )

    return records


def get_dashboard_statistics():
    """
    Calculate attendance statistics for today.
    """

    now = datetime.now(RWANDA_TIMEZONE)
    today = now.date().isoformat()

    # -----------------------------------------
    # 1. Get all students
    # -----------------------------------------

    students_response = (
        supabase
        .table("students")
        .select("id, status")
        .execute()
    )

    students = students_response.data

    total_students = len(students)

    active_students = sum(
        1 for student in students
        if student["status"] is True
    )

    # -----------------------------------------
    # 2. Get active RFID cards
    # -----------------------------------------

    rfid_response = (
        supabase
        .table("rfid_cards")
        .select("id")
        .eq("active", True)
        .execute()
    )

    total_rfid_cards = len(rfid_response.data)

    # -----------------------------------------
    # 3. Get today's attendance
    # -----------------------------------------

    attendance_response = (
        supabase
        .table("attendance")
        .select("student_id")
        .eq("attendance_date", today)
        .execute()
    )

    # Remove duplicates just in case.
    present_student_ids = {
        record["student_id"]
        for record in attendance_response.data
    }

    present_today = len(present_student_ids)

    # -----------------------------------------
    # 4. Calculate absent students
    # -----------------------------------------

    absent_today = max(
        active_students - present_today,
        0
    )

    # -----------------------------------------
    # 5. Calculate attendance percentage
    # -----------------------------------------

    if active_students > 0:
        attendance_percentage = round(
            (present_today / active_students) * 100,
            2
        )
    else:
        attendance_percentage = 0.0

    return {
        "total_students": total_students,
        "active_students": active_students,
        "total_rfid_cards": total_rfid_cards,
        "present_today": present_today,
        "absent_today": absent_today,
        "attendance_percentage": attendance_percentage,
    }
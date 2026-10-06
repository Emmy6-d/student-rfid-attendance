from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.schemas.attendance import (
    AttendanceScan,
    AttendanceResponse,
    AttendanceRecordResponse,
    AttendanceStatisticsResponse
)

from app.services.attendance_service import (
    process_attendance_scan,
    get_attendance_records,
    get_today_attendance,
    get_student_attendance_history,
    get_dashboard_statistics,
    get_attendance_scan_events,
)


router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)


# ============================================================
# RFID SCAN
# ============================================================

@router.post(
    "/scan",
    response_model=AttendanceResponse
)
def scan_attendance(data: AttendanceScan):

    try:
        result = process_attendance_scan(data)

        return result

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "status": "server_error",
                "message": str(error)
            }
        )


# ============================================================
# GET ALL ATTENDANCE
# ============================================================

@router.get(
    "",
    response_model=list[AttendanceRecordResponse]
)
def get_attendance(
    attendance_date: str | None = Query(
        default=None,
        description="Attendance date in YYYY-MM-DD format"
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=500
    ),
    offset: int = Query(
        default=0,
        ge=0
    )
):

    try:

        return get_attendance_records(
            attendance_date=attendance_date,
            limit=limit,
            offset=offset
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# GET TODAY'S ATTENDANCE
# ============================================================

@router.get(
    "/today",
    response_model=list[AttendanceRecordResponse]
)
def get_today():

    try:

        return get_today_attendance()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@router.get("/events")
def attendance_scan_events(
    since: datetime | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
):
    try:
        return get_attendance_scan_events(since=since, limit=limit)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


# ============================================================
# GET STUDENT ATTENDANCE HISTORY
# ============================================================

@router.get(
    "/student/{student_uuid}",
    response_model=list[AttendanceRecordResponse]
)
def get_student_history(
    student_uuid: str,
    limit: int = Query(
        default=100,
        ge=1,
        le=500
    ),
    offset: int = Query(
        default=0,
        ge=0
    )
):

    try:

        records = get_student_attendance_history(
            student_uuid=student_uuid,
            limit=limit,
            offset=offset
        )

        return records

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# DASHBOARD STATISTICS
# ============================================================

@router.get(
    "/dashboard/statistics",
    response_model=AttendanceStatisticsResponse
)
def dashboard_statistics():

    try:

        return get_dashboard_statistics()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AttendanceScan(BaseModel):
    uid: str
    device_id: Optional[str] = None


class AttendanceResponse(BaseModel):
    success: bool
    status: str
    message: str
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    attendance_id: Optional[str] = None
    scanned_at: Optional[datetime] = None


class AttendanceRecordResponse(BaseModel):
    id: str

    # Database UUID of the student
    student_uuid: str

    # Human-readable student ID
    student_id: str

    student_name: str

    class_name: Optional[str] = None

    rfid_uid: str

    scanned_at: datetime

    attendance_date: str

    device_id: Optional[str] = None

    status: str


class AttendanceStatisticsResponse(BaseModel):
    total_students: int
    active_students: int
    total_rfid_cards: int
    present_today: int
    absent_today: int
    attendance_percentage: float
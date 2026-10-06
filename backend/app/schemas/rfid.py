from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RFIDAssign(BaseModel):
    uid: str
    student_id: str


class RFIDUpdate(BaseModel):
    active: Optional[bool] = None


class RFIDEnrollmentCreate(BaseModel):
    student_id: str


class RFIDEnrollmentScan(BaseModel):
    uid: str = Field(min_length=1, max_length=32)
    device_id: Optional[str] = None


class RFIDResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    uid: str
    student_id: str
    active: bool
    assigned_at: datetime
    created_at: datetime
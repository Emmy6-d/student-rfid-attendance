from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class StudentCreate(BaseModel):
    student_id: str
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    class_name: Optional[str] = None
    status: bool = True


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    class_name: Optional[str] = None
    status: Optional[bool] = None


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    class_name: Optional[str] = None
    status: bool
    created_at: datetime
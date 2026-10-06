from typing import Optional

from app.database import supabase
from app.schemas.student import StudentCreate, StudentUpdate


def create_student(student: StudentCreate):
    data = student.model_dump(exclude_none=True)

    response = (
        supabase
        .table("students")
        .insert(data)
        .execute()
    )

    return response.data


def get_students():
    response = (
        supabase
        .table("students")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    return response.data


def get_student(student_uuid: str):
    response = (
        supabase
        .table("students")
        .select("*")
        .eq("id", student_uuid)
        .execute()
    )

    if not response.data:
        return None

    return response.data[0]


def update_student(
    student_uuid: str,
    student: StudentUpdate
):
    data = student.model_dump(
        exclude_none=True
    )

    if not data:
        return None

    response = (
        supabase
        .table("students")
        .update(data)
        .eq("id", student_uuid)
        .execute()
    )

    if not response.data:
        return None

    return response.data[0]


def delete_student(student_uuid: str):
    response = (
        supabase
        .table("students")
        .delete()
        .eq("id", student_uuid)
        .execute()
    )

    if not response.data:
        return None

    return response.data[0]
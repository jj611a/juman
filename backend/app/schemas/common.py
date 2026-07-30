"""Common schema primitives shared by all modules."""

from pydantic import BaseModel, ConfigDict, Field


class APIModel(BaseModel):
    """Base Pydantic model with ORM-friendly configuration."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class MessageResponse(APIModel):
    """Simple message envelope."""

    success: bool = True
    message: str


class PaginationParams(APIModel):
    """Reusable pagination query parameters."""

    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=200)


class PaginationMeta(APIModel):
    """Pagination metadata for list responses."""

    offset: int
    limit: int
    total: int

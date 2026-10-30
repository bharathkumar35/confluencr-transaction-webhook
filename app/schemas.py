from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator

class WebhookRequest(BaseModel):
    transaction_id: str = Field(min_length=1, max_length=120)
    source_account: str = Field(min_length=1, max_length=120)
    destination_account: str = Field(min_length=1, max_length=120)
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    currency: str = Field(min_length=3, max_length=3)

    @field_validator("currency")
    @classmethod
    def currency_is_uppercase(cls, value: str) -> str:
        value = value.upper()
        if not value.isalpha():
            raise ValueError("currency must contain three alphabetic characters")
        return value

class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    transaction_id: str
    source_account: str
    destination_account: str
    amount: Decimal
    currency: str
    status: str
    created_at: datetime
    processed_at: datetime | None

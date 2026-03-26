from app.integrations.base import ExternalProviderAdapter
from app.integrations.providers.mock_vendor_a import PROVIDER_ID as MOCK_VENDOR_A_ID, get_mock_vendor_a


def get_adapter(provider_id: str) -> ExternalProviderAdapter:
    if provider_id == MOCK_VENDOR_A_ID:
        return get_mock_vendor_a()
    raise ValueError(f"Unknown provider_id: {provider_id}")


def list_all_registered_adapters() -> list[ExternalProviderAdapter]:
    return [get_mock_vendor_a()]

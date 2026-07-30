"""API v1 router — future modules register here with a single include line."""

from fastapi import APIRouter

from app.api.v1.endpoints import health, root, version
from app.modules.audit.api import router as audit_router
from app.modules.categories.api import router as categories_router
from app.modules.customers.api import router as customers_router
from app.modules.identity.api import router as identity_router
from app.modules.inventory.api import router as inventory_router
from app.modules.calendar.api import router as calendar_router
from app.modules.media.api import router as media_router
from app.modules.rbac.api import router as rbac_router
from app.modules.reservations.api import router as reservations_router
from app.modules.rentals.api import router as rentals_router
from app.modules.returns.api import router as returns_router
from app.modules.inspection.api import router as inspection_router
from app.modules.processing.api import router as processing_router
from app.modules.reports.api import router as reports_router
from app.modules.sales.api import router as sales_router
from app.modules.settlements.api import router as settlements_router
from app.modules.system_admin.api import router as system_admin_router
from app.modules.settings.api import router as settings_router

api_v1_router = APIRouter()
api_v1_router.include_router(root.router, tags=["Root"])
api_v1_router.include_router(health.router, tags=["Health"])
api_v1_router.include_router(version.router, tags=["Version"])
api_v1_router.include_router(identity_router)
api_v1_router.include_router(settings_router)
api_v1_router.include_router(rbac_router)
api_v1_router.include_router(media_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(categories_router)
api_v1_router.include_router(customers_router)
api_v1_router.include_router(inventory_router)
api_v1_router.include_router(calendar_router)
api_v1_router.include_router(reservations_router)
api_v1_router.include_router(rentals_router)
api_v1_router.include_router(returns_router)
api_v1_router.include_router(inspection_router)
api_v1_router.include_router(processing_router)
api_v1_router.include_router(sales_router)
api_v1_router.include_router(settlements_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(system_admin_router)

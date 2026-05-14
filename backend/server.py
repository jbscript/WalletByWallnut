from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, date, timedelta
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Single demo user (no auth)
DEMO_USER = "demo"

# ------------------------- Models -------------------------

class Account(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = DEMO_USER
    name: str
    type: str = "cash"  # cash, bank, card, savings, investment
    currency: str = "INR"
    initial_balance: float = 0.0
    color: str = "#10b981"
    icon: str = "wallet"
    archived: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AccountCreate(BaseModel):
    name: str
    type: str = "cash"
    currency: str = "INR"
    initial_balance: float = 0.0
    color: str = "#10b981"
    icon: str = "wallet"

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    currency: Optional[str] = None
    initial_balance: Optional[float] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    archived: Optional[bool] = None

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = DEMO_USER
    name: str
    type: Literal["income", "expense"] = "expense"
    color: str = "#f43f5e"
    icon: str = "tag"
    is_default: bool = False

class CategoryCreate(BaseModel):
    name: str
    type: Literal["income", "expense"] = "expense"
    color: str = "#f43f5e"
    icon: str = "tag"

class Record(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = DEMO_USER
    type: Literal["income", "expense", "transfer"] = "expense"
    amount: float
    account_id: str
    to_account_id: Optional[str] = None  # for transfers
    category_id: Optional[str] = None
    note: str = ""
    payee: str = ""
    date: str  # ISO date (YYYY-MM-DD)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecordCreate(BaseModel):
    type: Literal["income", "expense", "transfer"] = "expense"
    amount: float
    account_id: str
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None
    note: str = ""
    payee: str = ""
    date: str

class RecordUpdate(BaseModel):
    type: Optional[Literal["income", "expense", "transfer"]] = None
    amount: Optional[float] = None
    account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None
    note: Optional[str] = None
    payee: Optional[str] = None
    date: Optional[str] = None

# ------------------------- Helpers -------------------------

def serialize_doc(doc: dict) -> dict:
    doc.pop('_id', None)
    if 'created_at' in doc and isinstance(doc['created_at'], datetime):
        doc['created_at'] = doc['created_at'].isoformat()
    return doc

DEFAULT_CATEGORIES = [
    {"name": "Food & Drinks", "type": "expense", "color": "#f43f5e", "icon": "utensils"},
    {"name": "Shopping", "type": "expense", "color": "#3b82f6", "icon": "shopping-bag"},
    {"name": "Housing", "type": "expense", "color": "#f59e0b", "icon": "home"},
    {"name": "Transportation", "type": "expense", "color": "#06b6d4", "icon": "bus"},
    {"name": "Vehicle", "type": "expense", "color": "#a855f7", "icon": "car"},
    {"name": "Life & Entertainment", "type": "expense", "color": "#84cc16", "icon": "ticket"},
    {"name": "Communication, PC", "type": "expense", "color": "#64748b", "icon": "monitor"},
    {"name": "Financial expenses", "type": "expense", "color": "#dc2626", "icon": "credit-card"},
    {"name": "Investments", "type": "expense", "color": "#0ea5e9", "icon": "trending-up"},
    {"name": "Income", "type": "income", "color": "#10b981", "icon": "wallet"},
    {"name": "Salary", "type": "income", "color": "#059669", "icon": "briefcase"},
    {"name": "Gifts", "type": "income", "color": "#f97316", "icon": "gift"},
]

async def seed_defaults():
    # Seed categories
    existing = await db.categories.count_documents({"user_id": DEMO_USER})
    if existing == 0:
        docs = []
        for cat in DEFAULT_CATEGORIES:
            obj = Category(**cat, is_default=True)
            docs.append(obj.model_dump())
        if docs:
            await db.categories.insert_many(docs)
        logger.info(f"Seeded {len(docs)} default categories")

    # Seed a cash account
    acc_count = await db.accounts.count_documents({"user_id": DEMO_USER})
    if acc_count == 0:
        acc = Account(name="Cash", type="cash", currency="INR", initial_balance=0.0, color="#06b6d4", icon="wallet")
        await db.accounts.insert_one(acc.model_dump())
        logger.info("Seeded default Cash account")

# ------------------------- Account routes -------------------------

@api_router.get("/accounts", response_model=List[Account])
async def list_accounts(include_archived: bool = True):
    q = {"user_id": DEMO_USER}
    if not include_archived:
        q["archived"] = False
    items = await db.accounts.find(q, {"_id": 0}).to_list(500)
    return items

@api_router.post("/accounts", response_model=Account)
async def create_account(payload: AccountCreate):
    obj = Account(**payload.model_dump())
    await db.accounts.insert_one(obj.model_dump())
    return obj

@api_router.patch("/accounts/{account_id}", response_model=Account)
async def update_account(account_id: str, payload: AccountUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.accounts.update_one({"id": account_id, "user_id": DEMO_USER}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Account not found")
    doc = await db.accounts.find_one({"id": account_id}, {"_id": 0})
    return doc

@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str):
    # Cascade delete records belonging to this account
    await db.records.delete_many({"$or": [{"account_id": account_id}, {"to_account_id": account_id}], "user_id": DEMO_USER})
    res = await db.accounts.delete_one({"id": account_id, "user_id": DEMO_USER})
    if res.deleted_count == 0:
        raise HTTPException(404, "Account not found")
    return {"ok": True}

# ------------------------- Category routes -------------------------

@api_router.get("/categories", response_model=List[Category])
async def list_categories(type: Optional[str] = None):
    q = {"user_id": DEMO_USER}
    if type:
        q["type"] = type
    items = await db.categories.find(q, {"_id": 0}).to_list(500)
    return items

@api_router.post("/categories", response_model=Category)
async def create_category(payload: CategoryCreate):
    obj = Category(**payload.model_dump())
    await db.categories.insert_one(obj.model_dump())
    return obj

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    res = await db.categories.delete_one({"id": category_id, "user_id": DEMO_USER, "is_default": False})
    if res.deleted_count == 0:
        raise HTTPException(404, "Category not found or is default")
    return {"ok": True}

# ------------------------- Record routes -------------------------

@api_router.get("/records", response_model=List[Record])
async def list_records(
    account_id: Optional[str] = None,
    category_id: Optional[str] = None,
    type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = "date_desc",
    limit: int = 1000,
):
    q = {"user_id": DEMO_USER}
    if account_id:
        q["$or"] = [{"account_id": account_id}, {"to_account_id": account_id}]
    if category_id:
        q["category_id"] = category_id
    if type:
        q["type"] = type
    if start_date or end_date:
        date_q = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date
        q["date"] = date_q
    if search:
        q["$or"] = q.get("$or", []) + [
            {"note": {"$regex": search, "$options": "i"}},
            {"payee": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.records.find(q, {"_id": 0})
    sort_field = "date"
    direction = -1 if sort == "date_desc" else 1
    if sort == "amount_desc":
        sort_field, direction = "amount", -1
    elif sort == "amount_asc":
        sort_field, direction = "amount", 1
    cursor = cursor.sort([(sort_field, direction), ("created_at", -1)])
    items = await cursor.to_list(limit)
    return items

@api_router.post("/records", response_model=Record)
async def create_record(payload: RecordCreate):
    if payload.type == "transfer" and not payload.to_account_id:
        raise HTTPException(400, "to_account_id required for transfer")
    obj = Record(**payload.model_dump())
    await db.records.insert_one(obj.model_dump())
    return obj

@api_router.patch("/records/{record_id}", response_model=Record)
async def update_record(record_id: str, payload: RecordUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.records.update_one({"id": record_id, "user_id": DEMO_USER}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Record not found")
    doc = await db.records.find_one({"id": record_id}, {"_id": 0})
    return doc

@api_router.delete("/records/{record_id}")
async def delete_record(record_id: str):
    res = await db.records.delete_one({"id": record_id, "user_id": DEMO_USER})
    if res.deleted_count == 0:
        raise HTTPException(404, "Record not found")
    return {"ok": True}

# ------------------------- Analytics -------------------------

async def _account_balances():
    """Compute current balance for each account using initial_balance + records."""
    accounts = await db.accounts.find({"user_id": DEMO_USER}, {"_id": 0}).to_list(500)
    records = await db.records.find({"user_id": DEMO_USER}, {"_id": 0}).to_list(20000)
    balances = {a["id"]: float(a.get("initial_balance") or 0.0) for a in accounts}
    for r in records:
        amt = float(r["amount"])
        if r["type"] == "income":
            balances[r["account_id"]] = balances.get(r["account_id"], 0) + amt
        elif r["type"] == "expense":
            balances[r["account_id"]] = balances.get(r["account_id"], 0) - amt
        elif r["type"] == "transfer":
            balances[r["account_id"]] = balances.get(r["account_id"], 0) - amt
            if r.get("to_account_id"):
                balances[r["to_account_id"]] = balances.get(r["to_account_id"], 0) + amt
    return accounts, records, balances

@api_router.get("/analytics/summary")
async def analytics_summary(start_date: str, end_date: str):
    accounts, records, balances = await _account_balances()
    total_balance = sum(balances.values())
    income = 0.0
    expense = 0.0
    for r in records:
        if r["date"] < start_date or r["date"] > end_date:
            continue
        if r["type"] == "income":
            income += float(r["amount"])
        elif r["type"] == "expense":
            expense += float(r["amount"])
    return {
        "total_balance": round(total_balance, 2),
        "income": round(income, 2),
        "expense": round(expense, 2),
        "cash_flow": round(income - expense, 2),
        "account_balances": {aid: round(bal, 2) for aid, bal in balances.items()},
    }

@api_router.get("/analytics/balance-trend")
async def analytics_balance_trend(start_date: str, end_date: str):
    accounts, records, _ = await _account_balances()
    sd = date.fromisoformat(start_date)
    ed = date.fromisoformat(end_date)
    initial_total = sum(float(a.get("initial_balance") or 0) for a in accounts)
    # apply all records before start_date to get opening balance
    opening = initial_total
    for r in records:
        if r["date"] < start_date:
            if r["type"] == "income":
                opening += float(r["amount"])
            elif r["type"] == "expense":
                opening -= float(r["amount"])
            # transfers net out
    # daily deltas within range
    deltas = defaultdict(float)
    for r in records:
        if start_date <= r["date"] <= end_date:
            if r["type"] == "income":
                deltas[r["date"]] += float(r["amount"])
            elif r["type"] == "expense":
                deltas[r["date"]] -= float(r["amount"])
    series = []
    running = opening
    d = sd
    while d <= ed:
        key = d.isoformat()
        running += deltas.get(key, 0.0)
        series.append({"date": key, "balance": round(running, 2)})
        d += timedelta(days=1)
    return {"series": series, "opening": round(opening, 2)}

@api_router.get("/analytics/expenses-structure")
async def analytics_expenses_structure(start_date: str, end_date: str):
    records = await db.records.find({"user_id": DEMO_USER, "type": "expense", "date": {"$gte": start_date, "$lte": end_date}}, {"_id": 0}).to_list(10000)
    categories = await db.categories.find({"user_id": DEMO_USER}, {"_id": 0}).to_list(500)
    cat_map = {c["id"]: c for c in categories}
    totals = defaultdict(float)
    for r in records:
        totals[r.get("category_id") or "uncategorized"] += float(r["amount"])
    result = []
    for cid, amt in totals.items():
        cat = cat_map.get(cid, {"name": "Uncategorized", "color": "#94a3b8", "icon": "tag"})
        result.append({
            "category_id": cid,
            "name": cat["name"],
            "color": cat["color"],
            "icon": cat.get("icon", "tag"),
            "amount": round(amt, 2),
        })
    result.sort(key=lambda x: x["amount"], reverse=True)
    return {"items": result, "total": round(sum(totals.values()), 2)}

@api_router.get("/analytics/report")
async def analytics_report(start_date: str, end_date: str, prev_start: str, prev_end: str):
    """Return per-category income/expense totals for current and previous period."""
    cats = await db.categories.find({"user_id": DEMO_USER}, {"_id": 0}).to_list(500)
    records = await db.records.find({"user_id": DEMO_USER}, {"_id": 0}).to_list(20000)

    def period_totals(s, e):
        income = defaultdict(float)
        expense = defaultdict(float)
        for r in records:
            if r["date"] < s or r["date"] > e:
                continue
            cid = r.get("category_id") or "uncategorized"
            if r["type"] == "income":
                income[cid] += float(r["amount"])
            elif r["type"] == "expense":
                expense[cid] += float(r["amount"])
        return income, expense

    cur_inc, cur_exp = period_totals(start_date, end_date)
    prv_inc, prv_exp = period_totals(prev_start, prev_end)
    cat_map = {c["id"]: c for c in cats}

    def build(items_cur, items_prv, ctype):
        rows = []
        keys = set(items_cur.keys()) | set(items_prv.keys())
        # ensure all categories of this type appear
        for c in cats:
            if c["type"] == ctype:
                keys.add(c["id"])
        for cid in keys:
            cat = cat_map.get(cid, {"name": "Uncategorized", "color": "#94a3b8", "icon": "tag", "type": ctype})
            rows.append({
                "category_id": cid,
                "name": cat["name"],
                "color": cat["color"],
                "icon": cat.get("icon", "tag"),
                "current": round(items_cur.get(cid, 0.0), 2),
                "previous": round(items_prv.get(cid, 0.0), 2),
            })
        rows.sort(key=lambda x: x["current"], reverse=True)
        return rows

    return {
        "income": {
            "rows": build(cur_inc, prv_inc, "income"),
            "current_total": round(sum(cur_inc.values()), 2),
            "previous_total": round(sum(prv_inc.values()), 2),
        },
        "expense": {
            "rows": build(cur_exp, prv_exp, "expense"),
            "current_total": round(sum(cur_exp.values()), 2),
            "previous_total": round(sum(prv_exp.values()), 2),
        },
    }

@api_router.get("/analytics/cash-flow")
async def analytics_cash_flow(start_date: str, end_date: str):
    """Monthly cash flow buckets between dates."""
    records = await db.records.find({"user_id": DEMO_USER, "date": {"$gte": start_date, "$lte": end_date}}, {"_id": 0}).to_list(20000)
    buckets = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for r in records:
        month_key = r["date"][:7]  # YYYY-MM
        if r["type"] == "income":
            buckets[month_key]["income"] += float(r["amount"])
        elif r["type"] == "expense":
            buckets[month_key]["expense"] += float(r["amount"])
    series = []
    for k in sorted(buckets.keys()):
        series.append({
            "month": k,
            "income": round(buckets[k]["income"], 2),
            "expense": round(buckets[k]["expense"], 2),
            "net": round(buckets[k]["income"] - buckets[k]["expense"], 2),
        })
    return {"series": series}

@api_router.get("/")
async def root():
    return {"message": "Wallet API"}

# Register routes
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def on_startup():
    await seed_defaults()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

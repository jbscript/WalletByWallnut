from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import csv
import io
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Any
import uuid
from datetime import datetime, timezone, date, timedelta
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
DEMO_USER = "demo"

# ------------------------- Models -------------------------

class Account(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = DEMO_USER
    name: str
    type: str = "cash"
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
    parent_id: Optional[str] = None  # None = top-level category
    external_id: Optional[str] = None  # Original IDs from BudgetBakers data
    is_default: bool = False

class CategoryCreate(BaseModel):
    name: str
    type: Literal["income", "expense"] = "expense"
    color: str = "#f43f5e"
    icon: str = "tag"
    parent_id: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[Literal["income", "expense"]] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[str] = None

class Record(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = DEMO_USER
    type: Literal["income", "expense", "transfer"] = "expense"
    amount: float
    account_id: str
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None  # leaf (subcategory) id
    note: str = ""
    payee: str = ""
    date: str  # YYYY-MM-DD
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

class RecurringRule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = DEMO_USER
    name: str
    type: Literal["income", "expense", "transfer"] = "expense"
    amount: float
    account_id: str
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None
    payee: str = ""
    note: str = ""
    frequency: Literal["daily", "weekly", "monthly", "yearly"] = "monthly"
    interval: int = 1  # every N units
    start_date: str   # YYYY-MM-DD
    next_run: str     # YYYY-MM-DD
    end_date: Optional[str] = None
    last_run: Optional[str] = None
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecurringCreate(BaseModel):
    name: str
    type: Literal["income", "expense", "transfer"] = "expense"
    amount: float
    account_id: str
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None
    payee: str = ""
    note: str = ""
    frequency: Literal["daily", "weekly", "monthly", "yearly"] = "monthly"
    interval: int = 1
    start_date: str
    end_date: Optional[str] = None

class RecurringUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[Literal["income", "expense", "transfer"]] = None
    amount: Optional[float] = None
    account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None
    payee: Optional[str] = None
    note: Optional[str] = None
    frequency: Optional[Literal["daily", "weekly", "monthly", "yearly"]] = None
    interval: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    active: Optional[bool] = None

# ------------------------- Seed data (BudgetBakers hierarchy) -------------------------

PARENT_META = {
    "Food & Drinks":     ("expense", "#f43f5e", "utensils"),
    "Shopping":          ("expense", "#3b82f6", "shopping-bag"),
    "Housing":           ("expense", "#f59e0b", "home"),
    "Transportation":    ("expense", "#06b6d4", "bus"),
    "Vehicle":           ("expense", "#a855f7", "car"),
    "Life & Entertainment": ("expense", "#84cc16", "ticket"),
    "Communication, PC": ("expense", "#64748b", "monitor"),
    "Financial expenses":("expense", "#dc2626", "credit-card"),
    "Investments":       ("expense", "#0ea5e9", "trending-up"),
    "Income":            ("income",  "#10b981", "wallet"),
    "Others":            ("expense", "#94a3b8", "tag"),
}

# Subcategory mapping {parent_name: [(name, external_id), ...]}
SUBCATEGORIES = {
    "Food & Drinks": [
        ("Food & Drinks", "-Category_7124094e-4171-4e54-b537-8b3400487013"),
        ("Bar, cafe", "1002"),
        ("Restaurant, fast-food", "1001"),
        ("Groceries", "1000"),
    ],
    "Shopping": [
        ("Drug-store, chemist", "2011"),
        ("Shopping", "2010"),
        ("Leisure time", "2009"),
        ("Stationery, tools", "2008"),
        ("Gifts, joy", "2007"),
        ("Electronics, accessories", "2006"),
        ("Pets, animals", "2005"),
        ("Home, garden", "2004"),
        ("Kids", "2003"),
        ("Health and beauty", "2002"),
        ("Jewels, accessories", "2001"),
        ("Clothes & Footwear", "2000"),
    ],
    "Housing": [
        ("Property insurance", "3010"),
        ("Housing", "3005"),
        ("Maintenance, repairs", "3004"),
        ("Services", "3003"),
        ("Energy, utilities", "3002"),
        ("Mortgage", "3001"),
        ("Rent", "3000"),
    ],
    "Transportation": [
        ("Transportation", "4004"),
        ("Business trips", "4003"),
        ("Long distance", "4002"),
        ("Taxi", "4001"),
        ("Public transport", "4000"),
    ],
    "Vehicle": [
        ("Leasing", "8006"),
        ("Vehicle insurance", "5010"),
        ("Vehicle", "5004"),
        ("Rentals", "5003"),
        ("Vehicle maintenance", "5002"),
        ("Parking", "5001"),
        ("Fuel", "5000"),
    ],
    "Life & Entertainment": [
        ("Life & Entertainment", "6013"),
        ("Lottery, gambling", "6012"),
        ("Alcohol, tobacco", "6011"),
        ("Charity, gifts", "6010"),
        ("Holiday, trips, hotels", "6009"),
        ("TV, Streaming", "6008"),
        ("Books, audio, subscriptions", "6007"),
        ("Education, development", "6006"),
        ("Hobbies", "6005"),
        ("Life events", "6004"),
        ("Culture, sport events", "6003"),
        ("Active sport, fitness", "6002"),
        ("Wellness, beauty", "6001"),
        ("Health care, doctor", "6000"),
    ],
    "Communication, PC": [
        ("Communication, PC", "7005"),
        ("Postal services", "7004"),
        ("Software, apps, games", "7003"),
        ("Internet", "7002"),
        ("Telephony, mobile phone", "7001"),
    ],
    "Financial expenses": [
        ("Financial expenses", "8008"),
        ("Child Support", "8007"),
        ("Charges, Fees", "8005"),
        ("Advisory", "8004"),
        ("Fines", "8003"),
        ("Loans, interests", "8002"),
        ("Insurances", "8001"),
        ("Taxes", "8000"),
    ],
    "Investments": [
        ("Investments", "9005"),
        ("Collections", "9004"),
        ("Savings", "9003"),
        ("Financial investments", "9002"),
        ("Vehicles, chattels", "9001"),
        ("Realty", "9000"),
    ],
    "Income": [
        ("Income", "10011"),
        ("Gifts", "10010"),
        ("Child Support", "10009"),
        ("Refunds (tax, purchase)", "10008"),
        ("Lottery, gambling", "10007"),
        ("Checks, coupons", "10006"),
        ("Lending, renting", "10005"),
        ("Dues & grants", "10004"),
        ("Rental income", "10003"),
        ("Sale", "10002"),
        ("Interests, dividends", "10001"),
        ("Wage, invoices", "10000"),
    ],
    "Others": [
        ("Missing", "11001"),
        ("Others", "11000"),
    ],
}


async def seed_defaults():
    # Re-seed categories if no rows OR if no parent_id field exists (migrate)
    has_parents = await db.categories.count_documents({"user_id": DEMO_USER, "parent_id": None}) > 0
    has_subs = await db.categories.count_documents({"user_id": DEMO_USER, "parent_id": {"$ne": None}}) > 0
    if not (has_parents and has_subs):
        # wipe & reseed (demo only)
        await db.categories.delete_many({"user_id": DEMO_USER})
        total = 0
        for parent_name, (ptype, color, icon) in PARENT_META.items():
            parent = Category(name=parent_name, type=ptype, color=color, icon=icon, parent_id=None, is_default=True)
            await db.categories.insert_one(parent.model_dump())
            total += 1
            for sub_name, ext_id in SUBCATEGORIES.get(parent_name, []):
                sub = Category(
                    name=sub_name, type=ptype, color=color, icon=icon,
                    parent_id=parent.id, external_id=ext_id, is_default=True,
                )
                await db.categories.insert_one(sub.model_dump())
                total += 1
        logger.info(f"Seeded {total} categories ({len(PARENT_META)} parents + subs)")

    if await db.accounts.count_documents({"user_id": DEMO_USER}) == 0:
        acc = Account(name="Cash", type="cash", currency="INR", initial_balance=0.0, color="#06b6d4", icon="wallet")
        await db.accounts.insert_one(acc.model_dump())
        logger.info("Seeded default Cash account")

# ------------------------- Account routes -------------------------

@api_router.get("/accounts", response_model=List[Account])
async def list_accounts(include_archived: bool = True):
    q = {"user_id": DEMO_USER}
    if not include_archived:
        q["archived"] = False
    return await db.accounts.find(q, {"_id": 0}).to_list(500)

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
    await db.records.delete_many({"$or": [{"account_id": account_id}, {"to_account_id": account_id}], "user_id": DEMO_USER})
    res = await db.accounts.delete_one({"id": account_id, "user_id": DEMO_USER})
    if res.deleted_count == 0:
        raise HTTPException(404, "Account not found")
    return {"ok": True}

# ------------------------- Category routes -------------------------

@api_router.get("/categories", response_model=List[Category])
async def list_categories(type: Optional[str] = None, parent_id: Optional[str] = None):
    q = {"user_id": DEMO_USER}
    if type:
        q["type"] = type
    if parent_id == "null":
        q["parent_id"] = None
    elif parent_id:
        q["parent_id"] = parent_id
    return await db.categories.find(q, {"_id": 0}).to_list(500)

@api_router.post("/categories", response_model=Category)
async def create_category(payload: CategoryCreate):
    # Inherit color/icon from parent if not provided / parent exists
    if payload.parent_id:
        parent = await db.categories.find_one({"id": payload.parent_id, "user_id": DEMO_USER}, {"_id": 0})
        if not parent:
            raise HTTPException(404, "Parent category not found")
    obj = Category(**payload.model_dump())
    await db.categories.insert_one(obj.model_dump())
    return obj

@api_router.patch("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, payload: CategoryUpdate):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None or k == "parent_id"}
    if not updates:
        raise HTTPException(400, "No fields to update")
    if "parent_id" in updates and updates["parent_id"]:
        # validate parent
        parent = await db.categories.find_one({"id": updates["parent_id"], "user_id": DEMO_USER}, {"_id": 0})
        if not parent:
            raise HTTPException(404, "Parent category not found")
        if parent.get("parent_id") is not None:
            raise HTTPException(400, "Parent must be a top-level category")
    res = await db.categories.update_one({"id": category_id, "user_id": DEMO_USER}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Category not found")
    return await db.categories.find_one({"id": category_id}, {"_id": 0})

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    cat = await db.categories.find_one({"id": category_id, "user_id": DEMO_USER}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Category not found")
    # Cascade: also delete child subcategories if this is a parent
    child_ids = [c["id"] async for c in db.categories.find({"parent_id": category_id, "user_id": DEMO_USER}, {"_id": 0, "id": 1})]
    all_ids = [category_id] + child_ids
    # Null out records pointing at any of these
    await db.records.update_many({"category_id": {"$in": all_ids}, "user_id": DEMO_USER}, {"$set": {"category_id": None}})
    res = await db.categories.delete_many({"id": {"$in": all_ids}, "user_id": DEMO_USER})
    return {"ok": True, "deleted_count": res.deleted_count}

# ------------------------- Record routes -------------------------

@api_router.get("/records", response_model=List[Record])
async def list_records(
    account_id: Optional[str] = None,
    category_id: Optional[str] = None,
    parent_category_id: Optional[str] = None,
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
    elif parent_category_id:
        sub_ids = [c["id"] async for c in db.categories.find(
            {"$or": [{"id": parent_category_id}, {"parent_id": parent_category_id}], "user_id": DEMO_USER},
            {"_id": 0, "id": 1},
        )]
        q["category_id"] = {"$in": sub_ids}
    if type:
        q["type"] = type
    if start_date or end_date:
        date_q = {}
        if start_date: date_q["$gte"] = start_date
        if end_date:   date_q["$lte"] = end_date
        q["date"] = date_q
    if search:
        q["$or"] = q.get("$or", []) + [
            {"note": {"$regex": search, "$options": "i"}},
            {"payee": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.records.find(q, {"_id": 0})
    sort_field, direction = "date", -1
    if sort == "date_asc":   direction = 1
    if sort == "amount_desc": sort_field, direction = "amount", -1
    if sort == "amount_asc":  sort_field, direction = "amount", 1
    cursor = cursor.sort([(sort_field, direction), ("created_at", -1)])
    return await cursor.to_list(limit)

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
    return await db.records.find_one({"id": record_id}, {"_id": 0})

@api_router.delete("/records/{record_id}")
async def delete_record(record_id: str):
    res = await db.records.delete_one({"id": record_id, "user_id": DEMO_USER})
    if res.deleted_count == 0:
        raise HTTPException(404, "Record not found")
    return {"ok": True}

# ------------------------- Analytics -------------------------

async def _categories_map():
    cats = await db.categories.find({"user_id": DEMO_USER}, {"_id": 0}).to_list(2000)
    by_id = {c["id"]: c for c in cats}
    # leaf -> parent id (or own id if root)
    parent_of = {c["id"]: (c.get("parent_id") or c["id"]) for c in cats}
    return cats, by_id, parent_of

async def _account_balances():
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
    _, records, balances = await _account_balances()
    total_balance = sum(balances.values())
    income, expense = 0.0, 0.0
    for r in records:
        if r["date"] < start_date or r["date"] > end_date:
            continue
        if r["type"] == "income":  income += float(r["amount"])
        elif r["type"] == "expense": expense += float(r["amount"])
    return {
        "total_balance": round(total_balance, 2),
        "income": round(income, 2),
        "expense": round(expense, 2),
        "cash_flow": round(income - expense, 2),
        "account_balances": {aid: round(b, 2) for aid, b in balances.items()},
    }

@api_router.get("/analytics/balance-trend")
async def analytics_balance_trend(start_date: str, end_date: str):
    accounts, records, _ = await _account_balances()
    sd, ed = date.fromisoformat(start_date), date.fromisoformat(end_date)
    initial_total = sum(float(a.get("initial_balance") or 0) for a in accounts)
    opening = initial_total
    for r in records:
        if r["date"] < start_date:
            if r["type"] == "income": opening += float(r["amount"])
            elif r["type"] == "expense": opening -= float(r["amount"])
    deltas = defaultdict(float)
    for r in records:
        if start_date <= r["date"] <= end_date:
            if r["type"] == "income":   deltas[r["date"]] += float(r["amount"])
            elif r["type"] == "expense": deltas[r["date"]] -= float(r["amount"])
    series = []
    running = opening
    d = sd
    while d <= ed:
        running += deltas.get(d.isoformat(), 0.0)
        series.append({"date": d.isoformat(), "balance": round(running, 2)})
        d += timedelta(days=1)
    return {"series": series, "opening": round(opening, 2)}

@api_router.get("/analytics/expenses-structure")
async def analytics_expenses_structure(start_date: str, end_date: str, group_by: str = "parent"):
    records = await db.records.find(
        {"user_id": DEMO_USER, "type": "expense", "date": {"$gte": start_date, "$lte": end_date}},
        {"_id": 0},
    ).to_list(20000)
    cats, by_id, parent_of = await _categories_map()
    totals = defaultdict(float)
    for r in records:
        cid = r.get("category_id") or "uncategorized"
        bucket = parent_of.get(cid, cid) if group_by == "parent" else cid
        totals[bucket] += float(r["amount"])
    result = []
    for cid, amt in totals.items():
        cat = by_id.get(cid, {"name": "Uncategorized", "color": "#94a3b8", "icon": "tag"})
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
    cats, by_id, parent_of = await _categories_map()
    records = await db.records.find({"user_id": DEMO_USER}, {"_id": 0}).to_list(20000)

    def period_totals(s, e):
        inc_parent, exp_parent = defaultdict(float), defaultdict(float)
        inc_sub, exp_sub = defaultdict(float), defaultdict(float)
        for r in records:
            if r["date"] < s or r["date"] > e: continue
            cid = r.get("category_id") or "uncategorized"
            pid = parent_of.get(cid, cid)
            if r["type"] == "income":
                inc_parent[pid] += float(r["amount"])
                inc_sub[cid] += float(r["amount"])
            elif r["type"] == "expense":
                exp_parent[pid] += float(r["amount"])
                exp_sub[cid] += float(r["amount"])
        return inc_parent, exp_parent, inc_sub, exp_sub

    cur_ip, cur_ep, cur_is, cur_es = period_totals(start_date, end_date)
    prv_ip, prv_ep, prv_is, prv_es = period_totals(prev_start, prev_end)

    def build_parents(cur_p, prv_p, cur_s, prv_s, ctype):
        rows = []
        parents = [c for c in cats if c.get("parent_id") is None and c["type"] == ctype]
        # include any out-of-band parents seen in records
        for pid in (set(cur_p) | set(prv_p)):
            if pid not in {p["id"] for p in parents}:
                parents.append(by_id.get(pid, {"id": pid, "name": "Uncategorized", "color": "#94a3b8", "icon": "tag", "type": ctype}))
        for p in parents:
            pid = p["id"]
            children = []
            sub_ids = [c["id"] for c in cats if c.get("parent_id") == pid]
            for sid in sub_ids:
                s = by_id[sid]
                children.append({
                    "category_id": sid,
                    "name": s["name"],
                    "color": s["color"],
                    "icon": s.get("icon", "tag"),
                    "current": round(cur_s.get(sid, 0.0), 2),
                    "previous": round(prv_s.get(sid, 0.0), 2),
                })
            children.sort(key=lambda x: x["current"], reverse=True)
            rows.append({
                "category_id": pid,
                "name": p["name"],
                "color": p["color"],
                "icon": p.get("icon", "tag"),
                "current": round(cur_p.get(pid, 0.0), 2),
                "previous": round(prv_p.get(pid, 0.0), 2),
                "children": children,
            })
        rows.sort(key=lambda x: x["current"], reverse=True)
        return rows

    return {
        "income": {
            "rows": build_parents(cur_ip, prv_ip, cur_is, prv_is, "income"),
            "current_total": round(sum(cur_ip.values()), 2),
            "previous_total": round(sum(prv_ip.values()), 2),
        },
        "expense": {
            "rows": build_parents(cur_ep, prv_ep, cur_es, prv_es, "expense"),
            "current_total": round(sum(cur_ep.values()), 2),
            "previous_total": round(sum(prv_ep.values()), 2),
        },
    }

@api_router.get("/analytics/cash-flow")
async def analytics_cash_flow(start_date: str, end_date: str):
    records = await db.records.find(
        {"user_id": DEMO_USER, "date": {"$gte": start_date, "$lte": end_date}}, {"_id": 0},
    ).to_list(20000)
    buckets = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for r in records:
        m = r["date"][:7]
        if r["type"] == "income":  buckets[m]["income"] += float(r["amount"])
        elif r["type"] == "expense": buckets[m]["expense"] += float(r["amount"])
    series = [{
        "month": k,
        "income": round(buckets[k]["income"], 2),
        "expense": round(buckets[k]["expense"], 2),
        "net": round(buckets[k]["income"] - buckets[k]["expense"], 2),
    } for k in sorted(buckets.keys())]
    return {"series": series}

# ------------------------- Yearly analytics -------------------------

# Special subcategory names that get bucketed separately from "Lifestyle"
EMI_SUBS = {"loans, interests"}
INSURANCE_SUBS = {"insurances", "property insurance", "vehicle insurance"}
RENT_SUBS = {"rent", "mortgage"}
INVESTMENTS_PARENT = "investments"

def _verdict(value: float, good_max: float, watch_max: float, inverse: bool = False):
    """For most ratios lower=better. For savings_investment_ratio higher=better -> inverse=True."""
    if inverse:
        if value >= good_max: return "good"
        if value >= watch_max: return "watch"
        return "high"
    if value <= good_max: return "good"
    if value <= watch_max: return "watch"
    return "high"

@api_router.get("/analytics/yearly")
async def analytics_yearly(year: int):
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    cats, by_id, parent_of = await _categories_map()
    name_lc = {c["id"]: c["name"].strip().lower() for c in cats}
    parent_name_lc = {c["id"]: c["name"].strip().lower() for c in cats if c.get("parent_id") is None}

    records = await db.records.find(
        {"user_id": DEMO_USER, "date": {"$gte": start, "$lte": end}}, {"_id": 0},
    ).to_list(50000)

    total_income = 0.0
    total_expense = 0.0
    total_investment = 0.0
    total_emi = 0.0
    total_insurance = 0.0
    total_rent = 0.0
    monthly = defaultdict(lambda: {"income": 0.0, "expense": 0.0, "investment": 0.0})

    for r in records:
        amt = float(r["amount"])
        m = r["date"][:7]
        cid = r.get("category_id")
        sub_name = name_lc.get(cid or "", "")
        pid = parent_of.get(cid, cid) if cid else None
        parent_name = parent_name_lc.get(pid or "", "")

        if r["type"] == "income":
            total_income += amt
            monthly[m]["income"] += amt
        elif r["type"] == "expense":
            total_expense += amt
            monthly[m]["expense"] += amt
            if parent_name == INVESTMENTS_PARENT:
                total_investment += amt
                monthly[m]["investment"] += amt
            else:
                if sub_name in EMI_SUBS:        total_emi += amt
                elif sub_name in INSURANCE_SUBS: total_insurance += amt
                elif sub_name in RENT_SUBS:      total_rent += amt

    total_lifestyle = max(0.0, total_expense - total_emi - total_insurance - total_rent - total_investment)
    # Investments tracked as expense above? Yes — they sit inside total_expense too. Keep them out of lifestyle but inside total_expense bucket.
    # Net Cash Balance = Income - (Expenses + Investments). Per user formula treat investments as separate (not double counted in expenses).
    net_cash = total_income - (total_expense - total_investment) - total_investment  # = income - expense
    # Re-express per user: Income - (Expense_without_investment + Investments) = Income - Expense_total
    # Match user formula exactly: Income - (Expenses + Investments) where Expenses are expenses excluding investments
    expenses_excl_inv = total_expense - total_investment
    net_cash = total_income - (expenses_excl_inv + total_investment)

    avg_monthly_expense = round(expenses_excl_inv / 12.0, 2)
    avg_monthly_investment = round(total_investment / 12.0, 2)

    # Emergency fund: sum of balances on savings-type accounts
    accounts, _, balances = await _account_balances()
    emergency_fund = sum(balances.get(a["id"], 0.0) for a in accounts if a.get("type") == "savings")

    # Ratios (guard against zero income)
    def pct(num, denom):
        return round((num / denom) * 100, 2) if denom > 0 else 0.0

    lifestyle_ratio = pct(total_lifestyle, total_income)
    committed_ratio = pct(total_lifestyle + total_emi + total_insurance + total_rent, total_income)
    savings_inv_ratio = pct(net_cash + total_investment, total_income)
    emi_ratio = pct(total_emi, total_income)

    ratios = {
        "lifestyle":         {"value": lifestyle_ratio,    "verdict": _verdict(lifestyle_ratio, 50, 65)},
        "committed":         {"value": committed_ratio,    "verdict": _verdict(committed_ratio, 70, 85)},
        "savings_investment":{"value": savings_inv_ratio,  "verdict": _verdict(savings_inv_ratio, 20, 10, inverse=True)},
        "emi":               {"value": emi_ratio,          "verdict": _verdict(emi_ratio, 40, 50)},
    }

    series = []
    for i in range(1, 13):
        key = f"{year}-{i:02d}"
        b = monthly[key]
        series.append({
            "month": key,
            "income": round(b["income"], 2),
            "expense": round(b["expense"] - b["investment"], 2),  # expense excludes investment
            "investment": round(b["investment"], 2),
        })

    return {
        "year": year,
        "summary": {
            "total_income": round(total_income, 2),
            "total_expense": round(expenses_excl_inv, 2),
            "total_investment": round(total_investment, 2),
            "total_lifestyle": round(total_lifestyle, 2),
            "total_emi": round(total_emi, 2),
            "total_insurance": round(total_insurance, 2),
            "total_rent": round(total_rent, 2),
            "emergency_fund": round(emergency_fund, 2),
            "net_cash_balance": round(net_cash, 2),
            "avg_monthly_expense": avg_monthly_expense,
            "avg_monthly_investment": avg_monthly_investment,
        },
        "ratios": ratios,
        "monthly": series,
    }

# ------------------------- Recurring rules -------------------------

def _advance_date(d: str, frequency: str, interval: int) -> str:
    dt = date.fromisoformat(d)
    if frequency == "daily":
        dt = dt + timedelta(days=interval)
    elif frequency == "weekly":
        dt = dt + timedelta(weeks=interval)
    elif frequency == "monthly":
        # add interval months
        month = dt.month - 1 + interval
        year = dt.year + month // 12
        month = month % 12 + 1
        from calendar import monthrange
        day = min(dt.day, monthrange(year, month)[1])
        dt = date(year, month, day)
    elif frequency == "yearly":
        try:
            dt = dt.replace(year=dt.year + interval)
        except ValueError:
            # Feb 29 case
            dt = dt.replace(year=dt.year + interval, day=28)
    return dt.isoformat()

@api_router.get("/recurring", response_model=List[RecurringRule])
async def list_recurring():
    return await db.recurring.find({"user_id": DEMO_USER}, {"_id": 0}).to_list(500)

@api_router.post("/recurring", response_model=RecurringRule)
async def create_recurring(payload: RecurringCreate):
    if payload.type == "transfer" and not payload.to_account_id:
        raise HTTPException(400, "to_account_id required for transfer")
    data = payload.model_dump()
    data["next_run"] = data["start_date"]
    obj = RecurringRule(**data)
    await db.recurring.insert_one(obj.model_dump())
    return obj

@api_router.patch("/recurring/{rule_id}", response_model=RecurringRule)
async def update_recurring(rule_id: str, payload: RecurringUpdate):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    # If start_date changed and rule not yet run, sync next_run
    if "start_date" in updates:
        existing = await db.recurring.find_one({"id": rule_id, "user_id": DEMO_USER}, {"_id": 0})
        if existing and not existing.get("last_run"):
            updates["next_run"] = updates["start_date"]
    res = await db.recurring.update_one({"id": rule_id, "user_id": DEMO_USER}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Rule not found")
    return await db.recurring.find_one({"id": rule_id}, {"_id": 0})

@api_router.delete("/recurring/{rule_id}")
async def delete_recurring(rule_id: str):
    res = await db.recurring.delete_one({"id": rule_id, "user_id": DEMO_USER})
    if res.deleted_count == 0:
        raise HTTPException(404, "Rule not found")
    return {"ok": True}

@api_router.post("/recurring/run")
async def run_recurring():
    """Materialize all due recurring rules into actual records."""
    today = date.today().isoformat()
    rules = await db.recurring.find({"user_id": DEMO_USER, "active": True}, {"_id": 0}).to_list(500)
    created = 0
    for rule in rules:
        next_run = rule.get("next_run") or rule["start_date"]
        end_date_v = rule.get("end_date")
        # generate records for every occurrence on or before today
        while next_run <= today:
            if end_date_v and next_run > end_date_v:
                break
            rec = Record(
                type=rule["type"],
                amount=float(rule["amount"]),
                account_id=rule["account_id"],
                to_account_id=rule.get("to_account_id"),
                category_id=rule.get("category_id"),
                payee=rule.get("payee", ""),
                note=(rule.get("note", "") + (" [recurring]" if rule.get("note") else "[recurring]")).strip(),
                date=next_run,
            )
            await db.records.insert_one(rec.model_dump())
            created += 1
            # advance
            next_run = _advance_date(next_run, rule["frequency"], int(rule.get("interval", 1)))
        # save next_run and last_run
        await db.recurring.update_one(
            {"id": rule["id"]},
            {"$set": {"next_run": next_run, "last_run": today}},
        )
    return {"created": created}

# ------------------------- CSV Import -------------------------

KNOWN_FIELDS = ["date", "amount", "type", "category", "subcategory", "account", "payee", "note"]
FIELD_ALIASES = {
    "date": ["date", "transaction date", "txn date", "posted"],
    "amount": ["amount", "value", "debit/credit", "total"],
    "type": ["type", "transaction type", "kind"],
    "category": ["category", "parent category", "group"],
    "subcategory": ["subcategory", "sub-category", "sub category"],
    "account": ["account", "wallet", "from account"],
    "payee": ["payee", "merchant", "vendor", "description", "narration"],
    "note": ["note", "notes", "memo", "comment", "details"],
}

def _suggest_mapping(headers: List[str]) -> dict:
    result = {}
    lower = [h.strip().lower() for h in headers]
    for field, aliases in FIELD_ALIASES.items():
        for a in aliases:
            if a in lower:
                result[field] = headers[lower.index(a)]
                break
    return result

def _parse_csv(text: str) -> tuple:
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return [], []
    headers = [h.strip() for h in rows[0]]
    data = [r for r in rows[1:] if any((c or "").strip() for c in r)]
    return headers, data

def _parse_date(s: str) -> Optional[str]:
    s = (s or "").strip()
    if not s:
        return None
    fmts = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d.%m.%Y", "%Y/%m/%d", "%d %b %Y", "%d %B %Y"]
    for f in fmts:
        try:
            return datetime.strptime(s, f).date().isoformat()
        except ValueError:
            continue
    return None

class ImportPreviewBody(BaseModel):
    csv_text: str

@api_router.post("/import/preview")
async def import_preview(body: ImportPreviewBody):
    headers, rows = _parse_csv(body.csv_text)
    if not headers:
        raise HTTPException(400, "Empty CSV")
    return {
        "columns": headers,
        "suggested_mapping": _suggest_mapping(headers),
        "preview_rows": rows[:50],
        "total_rows": len(rows),
        "known_fields": KNOWN_FIELDS,
    }

class ImportCommitBody(BaseModel):
    csv_text: str
    mapping: dict  # {field_name: column_header}
    default_account_id: str
    default_type: Literal["income", "expense"] = "expense"
    skip_first_row: bool = True  # header

@api_router.post("/import/commit")
async def import_commit(body: ImportCommitBody):
    headers, rows = _parse_csv(body.csv_text)
    if not headers:
        raise HTTPException(400, "Empty CSV")
    if not await db.accounts.find_one({"id": body.default_account_id, "user_id": DEMO_USER}):
        raise HTTPException(404, "Default account not found")

    col_idx = {h: i for i, h in enumerate(headers)}
    accounts = await db.accounts.find({"user_id": DEMO_USER}, {"_id": 0}).to_list(500)
    acc_by_name = {a["name"].strip().lower(): a["id"] for a in accounts}
    categories = await db.categories.find({"user_id": DEMO_USER}, {"_id": 0}).to_list(2000)
    parent_ids = {c["id"] for c in categories if c.get("parent_id") is None}
    sub_by_name = defaultdict(list)  # name -> [(id, parent_id)]
    parent_by_name = {}
    for c in categories:
        if c.get("parent_id") is None:
            parent_by_name[c["name"].strip().lower()] = c["id"]
        else:
            sub_by_name[c["name"].strip().lower()].append((c["id"], c["parent_id"]))

    def resolve_category(parent_name: Optional[str], sub_name: Optional[str]) -> Optional[str]:
        p_lower = (parent_name or "").strip().lower()
        s_lower = (sub_name or "").strip().lower()
        if s_lower:
            candidates = sub_by_name.get(s_lower, [])
            if candidates:
                if p_lower and p_lower in parent_by_name:
                    pid = parent_by_name[p_lower]
                    for cid, parent_id in candidates:
                        if parent_id == pid:
                            return cid
                return candidates[0][0]
        if p_lower and p_lower in sub_by_name:
            # parent_name matched a sub
            return sub_by_name[p_lower][0][0]
        if p_lower and p_lower in parent_by_name:
            return parent_by_name[p_lower]
        return None

    def get_cell(row: list, field: str) -> Optional[str]:
        col = body.mapping.get(field)
        if not col or col not in col_idx:
            return None
        i = col_idx[col]
        return row[i] if i < len(row) else None

    imported = 0
    skipped = 0
    errors: List[dict] = []
    docs = []
    for line_no, row in enumerate(rows, start=2):  # row 1 is header
        try:
            raw_amt = (get_cell(row, "amount") or "").replace(",", "").replace("₹", "").replace("$", "").strip()
            if not raw_amt:
                skipped += 1; errors.append({"row": line_no, "reason": "missing amount"}); continue
            amt = float(raw_amt)
            raw_date = get_cell(row, "date")
            d = _parse_date(raw_date) if raw_date else date.today().isoformat()
            if not d:
                skipped += 1; errors.append({"row": line_no, "reason": f"unparseable date '{raw_date}'"}); continue
            # type
            t_cell = (get_cell(row, "type") or "").strip().lower()
            if t_cell in ("income", "credit", "+", "in"):
                rtype = "income"
            elif t_cell in ("expense", "debit", "-", "out", "spend"):
                rtype = "expense"
            elif t_cell in ("transfer",):
                rtype = "transfer"
            else:
                rtype = "income" if amt > 0 and body.default_type == "income" else ("expense" if amt < 0 else body.default_type)
            amt_abs = abs(amt)
            # account
            acc_name = (get_cell(row, "account") or "").strip().lower()
            acc_id = acc_by_name.get(acc_name) if acc_name else body.default_account_id
            if not acc_id:
                acc_id = body.default_account_id
            # category
            cat_id = resolve_category(get_cell(row, "category"), get_cell(row, "subcategory"))
            payee = (get_cell(row, "payee") or "").strip()
            note = (get_cell(row, "note") or "").strip()
            rec = Record(
                type=rtype if rtype != "transfer" else "expense",  # transfer needs to_account; skip in CSV v1
                amount=amt_abs,
                account_id=acc_id,
                category_id=cat_id,
                payee=payee,
                note=note,
                date=d,
            )
            docs.append(rec.model_dump())
            imported += 1
        except Exception as e:
            skipped += 1; errors.append({"row": line_no, "reason": str(e)})
    if docs:
        await db.records.insert_many(docs)
    return {"imported": imported, "skipped": skipped, "errors": errors[:50]}

@api_router.get("/")
async def root():
    return {"message": "Wallet API"}

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
    # auto-materialize any due recurring transactions
    try:
        await run_recurring()
    except Exception as e:
        logger.warning(f"run_recurring on startup failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

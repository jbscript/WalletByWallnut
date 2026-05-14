"""Wallet API backend tests - accounts, categories, records, analytics."""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://budget-tracker-2544.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ------------------- Accounts -------------------
class TestAccounts:
    def test_list_accounts_seeded(self, s):
        r = s.get(f"{API}/accounts")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # default Cash account
        names = [a["name"] for a in data]
        assert "Cash" in names
        for a in data:
            assert "_id" not in a
            assert "id" in a

    def test_create_account_and_persist(self, s):
        payload = {"name": "TEST_Bank", "type": "bank", "currency": "INR", "initial_balance": 1000.0, "color": "#3b82f6", "icon": "wallet"}
        r = s.post(f"{API}/accounts", json=payload)
        assert r.status_code == 200
        created = r.json()
        assert created["name"] == "TEST_Bank"
        assert created["initial_balance"] == 1000.0
        assert "_id" not in created
        pytest.test_account_id = created["id"]

        # verify persistence
        r2 = s.get(f"{API}/accounts")
        ids = [a["id"] for a in r2.json()]
        assert created["id"] in ids

    def test_patch_account(self, s):
        aid = pytest.test_account_id
        r = s.patch(f"{API}/accounts/{aid}", json={"name": "TEST_Bank2"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Bank2"


# ------------------- Categories -------------------
class TestCategories:
    def test_default_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) >= 12
        for c in cats:
            assert "_id" not in c

    def test_filter_by_type(self, s):
        r = s.get(f"{API}/categories", params={"type": "income"})
        assert r.status_code == 200
        for c in r.json():
            assert c["type"] == "income"


# ------------------- Records -------------------
class TestRecords:
    def test_create_income_expense_transfer(self, s):
        accts = s.get(f"{API}/accounts").json()
        cash = next(a for a in accts if a["name"] == "Cash")
        bank = next(a for a in accts if a["id"] == pytest.test_account_id)
        cats = s.get(f"{API}/categories").json()
        exp_cat = next(c for c in cats if c["type"] == "expense")
        inc_cat = next(c for c in cats if c["type"] == "income")
        today = date.today().isoformat()

        # income
        r = s.post(f"{API}/records", json={"type": "income", "amount": 500.0, "account_id": cash["id"], "category_id": inc_cat["id"], "date": today, "note": "TEST_income"})
        assert r.status_code == 200
        pytest.income_id = r.json()["id"]

        # expense
        r = s.post(f"{API}/records", json={"type": "expense", "amount": 200.0, "account_id": cash["id"], "category_id": exp_cat["id"], "date": today, "note": "TEST_expense"})
        assert r.status_code == 200
        pytest.expense_id = r.json()["id"]

        # transfer
        r = s.post(f"{API}/records", json={"type": "transfer", "amount": 100.0, "account_id": cash["id"], "to_account_id": bank["id"], "date": today, "note": "TEST_transfer"})
        assert r.status_code == 200
        pytest.transfer_id = r.json()["id"]

        # transfer without to_account_id should 400
        r = s.post(f"{API}/records", json={"type": "transfer", "amount": 50, "account_id": cash["id"], "date": today})
        assert r.status_code == 400

    def test_list_filters_and_sort(self, s):
        r = s.get(f"{API}/records", params={"type": "expense"})
        assert r.status_code == 200
        for rec in r.json():
            assert rec["type"] == "expense"
        # search
        r = s.get(f"{API}/records", params={"search": "TEST_income"})
        assert r.status_code == 200
        assert any(rec.get("note") == "TEST_income" for rec in r.json())
        # sort by amount
        r = s.get(f"{API}/records", params={"sort": "amount_desc"})
        assert r.status_code == 200
        amounts = [rec["amount"] for rec in r.json()]
        assert amounts == sorted(amounts, reverse=True)

    def test_patch_record(self, s):
        r = s.patch(f"{API}/records/{pytest.expense_id}", json={"amount": 250.0})
        assert r.status_code == 200
        assert r.json()["amount"] == 250.0


# ------------------- Analytics -------------------
class TestAnalytics:
    def test_summary(self, s):
        today = date.today()
        sd = today.replace(day=1).isoformat()
        ed = today.isoformat()
        r = s.get(f"{API}/analytics/summary", params={"start_date": sd, "end_date": ed})
        assert r.status_code == 200
        data = r.json()
        for key in ["total_balance", "income", "expense", "cash_flow", "account_balances"]:
            assert key in data
        # income 500, expense 250 (after patch)
        assert data["income"] >= 500.0
        assert data["expense"] >= 250.0
        # cash_flow = income - expense
        assert abs(data["cash_flow"] - (data["income"] - data["expense"])) < 0.01

    def test_balance_trend(self, s):
        today = date.today()
        sd = (today - timedelta(days=7)).isoformat()
        ed = today.isoformat()
        r = s.get(f"{API}/analytics/balance-trend", params={"start_date": sd, "end_date": ed})
        assert r.status_code == 200
        data = r.json()
        assert "series" in data and "opening" in data
        assert len(data["series"]) == 8
        for pt in data["series"]:
            assert "date" in pt and "balance" in pt

    def test_expenses_structure(self, s):
        today = date.today()
        sd = today.replace(day=1).isoformat()
        ed = today.isoformat()
        r = s.get(f"{API}/analytics/expenses-structure", params={"start_date": sd, "end_date": ed})
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "total" in data
        assert data["total"] >= 250.0

    def test_report(self, s):
        today = date.today()
        sd = today.replace(day=1).isoformat()
        ed = today.isoformat()
        prev_end = today.replace(day=1) - timedelta(days=1)
        prev_start = prev_end.replace(day=1).isoformat()
        r = s.get(f"{API}/analytics/report", params={"start_date": sd, "end_date": ed, "prev_start": prev_start, "prev_end": prev_end.isoformat()})
        assert r.status_code == 200
        data = r.json()
        assert "income" in data and "expense" in data
        assert "rows" in data["income"] and "current_total" in data["income"]

    def test_cash_flow(self, s):
        today = date.today()
        sd = (today - timedelta(days=90)).isoformat()
        ed = today.isoformat()
        r = s.get(f"{API}/analytics/cash-flow", params={"start_date": sd, "end_date": ed})
        assert r.status_code == 200
        data = r.json()
        assert "series" in data
        if data["series"]:
            b = data["series"][0]
            assert all(k in b for k in ["month", "income", "expense", "net"])

    def test_transfer_balance_effect(self, s):
        # Transfer 100 from cash to bank. bank initial 1000 -> balance should be 1100
        r = s.get(f"{API}/analytics/summary", params={"start_date": "2000-01-01", "end_date": "2099-12-31"})
        data = r.json()
        bank_bal = data["account_balances"].get(pytest.test_account_id)
        assert bank_bal == 1100.0, f"expected 1100 got {bank_bal}"


# ------------------- Cleanup -------------------
class TestZCleanup:
    def test_delete_test_records(self, s):
        for rid_attr in ["income_id", "expense_id", "transfer_id"]:
            rid = getattr(pytest, rid_attr, None)
            if rid:
                r = s.delete(f"{API}/records/{rid}")
                assert r.status_code == 200

    def test_delete_test_account(self, s):
        r = s.delete(f"{API}/accounts/{pytest.test_account_id}")
        assert r.status_code == 200
        # verify removal
        accts = s.get(f"{API}/accounts").json()
        assert pytest.test_account_id not in [a["id"] for a in accts]

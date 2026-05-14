"""Tests for the new category hierarchy (11 parents + 82 subs = 93)
and parent_category_id filter on /api/records, plus analytics rollup."""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

EXPECTED_PARENTS = {
    "Food & Drinks", "Shopping", "Housing", "Transportation", "Vehicle",
    "Life & Entertainment", "Communication, PC", "Financial expenses",
    "Investments", "Income", "Others",
}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def all_cats(s):
    r = s.get(f"{API}/categories")
    assert r.status_code == 200
    return r.json()


class TestCategoryHierarchy:
    def test_total_count_93(self, all_cats):
        # 11 parents + 82 sub = 93
        assert len(all_cats) == 93, f"expected 93 got {len(all_cats)}"

    def test_11_parents_present(self, all_cats):
        parents = [c for c in all_cats if c.get("parent_id") in (None, "null")]
        names = {p["name"] for p in parents}
        assert len(parents) == 11
        assert names == EXPECTED_PARENTS

    def test_82_subs_with_valid_parents(self, all_cats):
        parent_ids = {c["id"] for c in all_cats if c.get("parent_id") is None}
        subs = [c for c in all_cats if c.get("parent_id")]
        assert len(subs) == 82
        for sub in subs:
            assert sub["parent_id"] in parent_ids, f"orphan sub {sub['name']}"
        # parent type must propagate
        by_id = {c["id"]: c for c in all_cats}
        for sub in subs:
            assert sub["type"] == by_id[sub["parent_id"]]["type"]

    def test_no_mongo_id_leak(self, all_cats):
        for c in all_cats:
            assert "_id" not in c

    def test_filter_type_income(self, s, all_cats):
        r = s.get(f"{API}/categories", params={"type": "income"})
        assert r.status_code == 200
        data = r.json()
        names = {c["name"] for c in data if c.get("parent_id") is None}
        # Income parent + its 12 subs => 13
        assert names == {"Income"}
        assert len(data) == 13
        for c in data:
            assert c["type"] == "income"

    def test_filter_type_expense(self, s):
        r = s.get(f"{API}/categories", params={"type": "expense"})
        assert r.status_code == 200
        data = r.json()
        # 10 expense parents + 70 expense subs = 80
        assert len(data) == 80
        for c in data:
            assert c["type"] == "expense"

    def test_filter_parent_id_null_returns_roots(self, s):
        r = s.get(f"{API}/categories", params={"parent_id": "null"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 11
        assert {c["name"] for c in data} == EXPECTED_PARENTS

    def test_filter_parent_id_returns_subs(self, s, all_cats):
        food = next(c for c in all_cats if c["name"] == "Food & Drinks" and c.get("parent_id") is None)
        r = s.get(f"{API}/categories", params={"parent_id": food["id"]})
        assert r.status_code == 200
        subs = r.json()
        # Food & Drinks has 4 subs per spec
        assert len(subs) == 4
        for sub in subs:
            assert sub["parent_id"] == food["id"]


class TestRecordsByParent:
    """Create records under different subs of one parent and verify
    /api/records?parent_category_id rolls them up + analytics groups."""

    @classmethod
    def setup_class(cls):
        s = requests.Session()
        cats = s.get(f"{API}/categories").json()
        cls.cats = cats
        cls.food_parent = next(c for c in cats if c["name"] == "Food & Drinks" and c.get("parent_id") is None)
        food_subs = [c for c in cats if c.get("parent_id") == cls.food_parent["id"]]
        # pick two subs (Groceries + Bar, cafe)
        cls.sub_groceries = next(c for c in food_subs if c["name"] == "Groceries")
        cls.sub_bar = next(c for c in food_subs if c["name"] == "Bar, cafe")

        # Create a TEST_ account to isolate
        r = s.post(f"{API}/accounts", json={
            "name": "TEST_HierAcct", "type": "cash", "currency": "INR",
            "initial_balance": 0.0,
        })
        cls.account_id = r.json()["id"]
        cls.today = date.today().isoformat()
        # 2 records under two different food subs
        r1 = s.post(f"{API}/records", json={
            "type": "expense", "amount": 100.0, "account_id": cls.account_id,
            "category_id": cls.sub_groceries["id"], "date": cls.today,
            "note": "TEST_HIER_groceries",
        })
        r2 = s.post(f"{API}/records", json={
            "type": "expense", "amount": 50.0, "account_id": cls.account_id,
            "category_id": cls.sub_bar["id"], "date": cls.today,
            "note": "TEST_HIER_bar",
        })
        assert r1.status_code == 200 and r2.status_code == 200
        cls.rec_ids = [r1.json()["id"], r2.json()["id"]]
        cls.s = s

    @classmethod
    def teardown_class(cls):
        for rid in cls.rec_ids:
            cls.s.delete(f"{API}/records/{rid}")
        cls.s.delete(f"{API}/accounts/{cls.account_id}")

    def test_records_filter_by_parent_id(self):
        r = self.s.get(f"{API}/records", params={"parent_category_id": self.food_parent["id"], "account_id": self.account_id})
        assert r.status_code == 200
        recs = r.json()
        ids = {x["id"] for x in recs}
        assert set(self.rec_ids).issubset(ids), f"parent filter missing records: got {ids}"
        for rec in recs:
            assert rec["category_id"] in (self.sub_groceries["id"], self.sub_bar["id"])

    def test_records_filter_by_leaf_id(self):
        r = self.s.get(f"{API}/records", params={"category_id": self.sub_groceries["id"], "account_id": self.account_id})
        assert r.status_code == 200
        recs = r.json()
        assert all(rec["category_id"] == self.sub_groceries["id"] for rec in recs)
        assert self.rec_ids[0] in [r["id"] for r in recs]

    def test_expenses_structure_rolls_up_by_parent(self):
        r = self.s.get(f"{API}/analytics/expenses-structure", params={
            "start_date": self.today, "end_date": self.today, "group_by": "parent",
        })
        assert r.status_code == 200
        items = r.json()["items"]
        food_row = next((x for x in items if x["category_id"] == self.food_parent["id"]), None)
        assert food_row is not None, "Food & Drinks parent bucket missing"
        assert food_row["amount"] >= 150.0  # 100 + 50

    def test_expenses_structure_group_by_leaf(self):
        r = self.s.get(f"{API}/analytics/expenses-structure", params={
            "start_date": self.today, "end_date": self.today, "group_by": "leaf",
        })
        items = r.json()["items"]
        ids = {x["category_id"] for x in items}
        assert self.sub_groceries["id"] in ids
        assert self.sub_bar["id"] in ids

    def test_report_has_children_array(self):
        today = date.today()
        sd = today.isoformat()
        ed = today.isoformat()
        prev_end = today - timedelta(days=1)
        prev_start = prev_end.isoformat()
        r = self.s.get(f"{API}/analytics/report", params={
            "start_date": sd, "end_date": ed, "prev_start": prev_start, "prev_end": prev_end.isoformat(),
        })
        assert r.status_code == 200
        data = r.json()
        exp_rows = data["expense"]["rows"]
        food_row = next((x for x in exp_rows if x["category_id"] == self.food_parent["id"]), None)
        assert food_row is not None
        assert "children" in food_row and isinstance(food_row["children"], list)
        child_ids = {c["category_id"] for c in food_row["children"]}
        assert self.sub_groceries["id"] in child_ids
        assert self.sub_bar["id"] in child_ids
        # parent current = sum of its visible children for this run
        assert food_row["current"] >= 150.0

    def test_account_archive_and_cascade_delete(self):
        # Create a temp account + record then DELETE account; record should be removed too
        a = self.s.post(f"{API}/accounts", json={"name": "TEST_CascadeAcct"}).json()
        rec = self.s.post(f"{API}/records", json={
            "type": "expense", "amount": 10.0, "account_id": a["id"],
            "category_id": self.sub_bar["id"], "date": self.today,
        }).json()
        # archive via patch
        r = self.s.patch(f"{API}/accounts/{a['id']}", json={"archived": True})
        assert r.status_code == 200 and r.json()["archived"] is True
        # delete account
        r = self.s.delete(f"{API}/accounts/{a['id']}")
        assert r.status_code == 200
        # record gone
        r = self.s.get(f"{API}/records", params={"account_id": a["id"]})
        assert all(x["id"] != rec["id"] for x in r.json())

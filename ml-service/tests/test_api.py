"""Uji layanan model terhadap docs/api-contract.md v0.4 bagian 5.

Jalankan dari folder ml-service: pytest -q
Mencakup skenario Rencana Pengujian di Project Plan: input valid, input tidak
lengkap, nilai di luar tabel ukuran, dan kunci antar layanan yang salah.
"""

import numpy as np
import pytest
from fastapi.testclient import TestClient

import app.main as main_mod
from app.main import NOTE_BULAN_TANPA_DATA_ASLI, app


@pytest.fixture
def client(monkeypatch):
    # Tanpa API_KEY, pemeriksaan kunci dilewati (mode pengembangan lokal).
    monkeypatch.delenv("API_KEY", raising=False)
    with TestClient(app) as c:
        yield c


def assert_format_error(body: dict, code: str, status: str = "fail"):
    """Format error kontrak 1.2: hanya status, code, message, errors, data di level atas."""
    assert body["status"] == status
    assert body["code"] == code
    assert isinstance(body["message"], str) and body["message"]
    assert set(body) <= {"status", "code", "message", "errors", "data"}


# ---------- /v1/health ----------

def test_health(client):
    r = client.get("/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert set(body["models"]) == {"sizeEstimator", "demand"}


def test_health_alias_lama_tetap_jalan(client):
    """/health dipertahankan sebagai alias supaya health check Render lama tidak gagal."""
    assert client.get("/health").status_code == 200
    assert "/health" not in client.get("/openapi.json").json()["paths"]


# ---------- /v1/size-estimate ----------

def test_size_dalam_tabel(client):
    r = client.post("/v1/size-estimate", json={"ld": 92, "tb": 160, "bb": 55})
    assert r.status_code == 200
    body = r.json()
    assert body["size"] == "M"
    assert body["inRange"] is True
    assert "M" in body["message"]
    assert body["tableVersion"]


@pytest.mark.parametrize("ld,ukuran", [(83, "XS"), (84, "S"), (88, "S"), (89, "M"), (124, "XXXL")])
def test_size_nilai_batas(client, ld, ukuran):
    r = client.post("/v1/size-estimate", json={"ld": ld, "tb": 160, "bb": 55})
    assert r.status_code == 200
    assert r.json()["size"] == ukuran


def test_size_di_luar_tabel_tetap_200(client):
    """Di luar tabel bukan error: layanan menjawab 200 dengan inRange false."""
    r = client.post("/v1/size-estimate", json={"ld": 130, "tb": 160, "bb": 55})
    assert r.status_code == 200
    body = r.json()
    assert body["inRange"] is False
    assert body["size"] is None
    assert "fitting" in body["message"].lower()


def test_size_input_tidak_valid_400(client):
    r = client.post("/v1/size-estimate", json={"ld": -5, "tb": 160, "bb": 55})
    assert r.status_code == 400
    body = r.json()
    assert_format_error(body, "VALIDATION_ERROR")
    assert body["errors"][0]["field"] == "ld"
    assert "Lingkar dada" in body["errors"][0]["message"]


def test_size_field_kurang(client):
    r = client.post("/v1/size-estimate", json={"ld": 92})
    assert r.status_code == 400
    body = r.json()
    assert_format_error(body, "VALIDATION_ERROR")
    fields = {e["field"] for e in body["errors"]}
    assert {"tb", "bb"} <= fields


def test_size_bukan_angka(client):
    r = client.post("/v1/size-estimate", json={"ld": "sembilan puluh", "tb": 160, "bb": 55})
    assert r.status_code == 400
    assert_format_error(r.json(), "VALIDATION_ERROR")


# ---------- /v1/predict/demand ----------

def test_predict_bentuk_response(client):
    r = client.post("/v1/predict/demand", json={"targetMonth": "2026-12"})
    assert r.status_code == 200
    body = r.json()
    assert body["targetMonth"] == "2026-12"
    assert {"name", "version"} <= set(body["model"])
    assert body["dataSource"] in {"asli", "contoh", "campuran"}
    assert body["predictions"], "predictions tidak boleh kosong"
    for item in body["predictions"]:
        assert set(item) == {"size", "predictedCount"}
        assert item["predictedCount"] >= 0


@pytest.mark.parametrize("bulan", ["2026-13", "2026-1", "Desember", "2026/12", ""])
def test_predict_format_bulan_salah(client, bulan):
    r = client.post("/v1/predict/demand", json={"targetMonth": bulan})
    assert r.status_code == 400
    body = r.json()
    assert_format_error(body, "VALIDATION_ERROR")
    assert body["errors"][0]["field"] == "targetMonth"


def test_predict_tanpa_target_month(client):
    r = client.post("/v1/predict/demand", json={})
    assert r.status_code == 400
    assert_format_error(r.json(), "VALIDATION_ERROR")


# ---------- keamanan dan error umum ----------

def test_api_key_salah_401(monkeypatch):
    monkeypatch.setenv("API_KEY", "kunci-benar")
    with TestClient(app) as c:
        r = c.post(
            "/v1/size-estimate",
            json={"ld": 92, "tb": 160, "bb": 55},
            headers={"X-API-Key": "kunci-salah"},
        )
        assert r.status_code == 401
        assert_format_error(r.json(), "UNAUTHORIZED")

        r_ok = c.post(
            "/v1/size-estimate",
            json={"ld": 92, "tb": 160, "bb": 55},
            headers={"X-API-Key": "kunci-benar"},
        )
        assert r_ok.status_code == 200


def test_health_tanpa_kunci_tetap_bisa(monkeypatch):
    """Backend memakai /health untuk membangunkan layanan, jadi tidak perlu kunci."""
    monkeypatch.setenv("API_KEY", "kunci-benar")
    with TestClient(app) as c:
        assert c.get("/v1/health").status_code == 200


def test_endpoint_tidak_ada_404(client):
    r = client.get("/v1/tidak-ada")
    assert r.status_code == 404
    assert_format_error(r.json(), "NOT_FOUND")


# ---------- jalur model sungguhan (pipeline tiruan) ----------

class PipelineTiruan:
    """Selalu memprediksi 1 pemesanan per minggu, supaya hasil bulanan mudah dihitung."""

    def predict(self, X):
        return np.ones(len(X))


@pytest.fixture
def client_model(client):
    main_mod.state["pipeline"] = PipelineTiruan()
    main_mod.state["meta"] = {
        "name": "ridge",
        "version": "1.0.0",
        "mae_validasi": 6.8,
        "data_source": "asli",
        "size_proportions": {"M": 0.5, "S": 0.25, "L": 0.25},
        "bulan_data_asli": [6, 7, 8, 9, 10, 11],
    }
    yield client
    main_mod.state["pipeline"] = None
    main_mod.state["meta"] = None


def test_predict_jumlah_mingguan_per_bulan(client_model):
    # Oktober 2026 punya 4 hari Senin (5, 12, 19, 26), jadi totalnya 4 x 1 pemesanan.
    body = client_model.post("/v1/predict/demand", json={"targetMonth": "2026-10"}).json()
    assert body["totalPredicted"] == 4.0
    assert body["sizeBreakdown"] == "proporsi_historis"
    assert body["model"]["maeValidasi"] == 6.8
    assert body["dataSource"] == "asli"
    per_ukuran = {p["size"]: p["predictedCount"] for p in body["predictions"]}
    assert per_ukuran == {"S": 1.0, "M": 2.0, "L": 1.0}
    # Urutan mengikuti tabel ukuran (kecil ke besar), bukan urutan proporsi.
    assert [p["size"] for p in body["predictions"]] == ["S", "M", "L"]


def test_predict_note_null_untuk_bulan_yang_ada_di_data_asli(client_model):
    body = client_model.post("/v1/predict/demand", json={"targetMonth": "2026-10"}).json()
    assert body["note"] is None


def test_predict_note_terisi_untuk_bulan_tanpa_data_asli(client_model):
    body = client_model.post("/v1/predict/demand", json={"targetMonth": "2026-12"}).json()
    assert body["note"] == NOTE_BULAN_TANPA_DATA_ASLI

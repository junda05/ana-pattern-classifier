"""Hierarchy navigation (general → competent → expert) and every terminal path of a prediction."""

import asyncio

import numpy as np
import pytest

from app.core.class_mapping import ClassificationLevel, HierarchyNavigator, ModelConfig
from tests.fakes import make_png, probability_vector

GENERAL = ClassificationLevel.GENERAL
COMPETENT = ClassificationLevel.COMPETENT
EXPERT = ClassificationLevel.EXPERT


# --- HierarchyNavigator.get_next_level ------------------------------------------------------------


@pytest.mark.parametrize(
    ("general_class", "competent_class", "expected"),
    [
        ("NEGATIVE", None, None),
        ("MITOTIC", None, (EXPERT, "mitotic_expert")),
        ("NUCLEAR", None, (COMPETENT, "nuclear_competent")),
        ("CYTOPLASMIC", None, (COMPETENT, "cytoplasmic_competent")),
        ("NUCLEAR", "NUCLEOLAR", (EXPERT, "nucleolar_expert")),
        ("CYTOPLASMIC", "CYTOPLASMIC_SPECKLED", (EXPERT, "cytoplasmic_speckled_expert")),
        ("CYTOPLASMIC", "CYTOPLASMIC_DISCRETE_DOTS", None),  # AC-18: expert-level pattern at competent
        ("NUCLEAR", "NUCLEAR_SPECKLED", None),  # expert level exists but has no trained model
        ("CYTOPLASMIC", "CYTOPLASMIC_FIBRILLAR", None),  # expert level exists but has no trained model
        ("NUCLEAR", "NUCLEAR_HOMOGENEOUS", None),
        ("NUCLEAR", "NUCLEAR_DENSE_FINE_SPECKLED", None),
        ("NUCLEAR", "NUCLEAR_CENTROMERE", None),
        ("CYTOPLASMIC", "CYTOPLASMIC_RETICULAR_AMA", None),
        ("CYTOPLASMIC", "CYTOPLASMIC_POLAR_GOLGI", None),
        ("NUCLEAR", "CYTOPLASMIC_SPECKLED", None),  # competent class from the other branch
        ("UNKNOWN", None, None),
    ],
)
def test_get_next_level(general_class, competent_class, expected):
    assert HierarchyNavigator.get_next_level(general_class, competent_class) == expected


def test_only_nucleolar_and_cytoplasmic_speckled_reach_an_expert_model_from_competent():
    reaching_expert = {
        competent_class
        for general_class, competent_model in [("NUCLEAR", "nuclear_competent"),
                                               ("CYTOPLASMIC", "cytoplasmic_competent")]
        for competent_class in ModelConfig.get_model_classes(competent_model)
        if HierarchyNavigator.get_next_level(general_class, competent_class) is not None
    }

    assert reaching_expert == {"NUCLEOLAR", "CYTOPLASMIC_SPECKLED"}


@pytest.mark.parametrize("general_class", ModelConfig.get_model_classes("general"))
def test_every_next_level_points_to_a_configured_model_of_that_level(general_class):
    competent_classes = [None, *ModelConfig.get_model_classes("nuclear_competent"),
                         *ModelConfig.get_model_classes("cytoplasmic_competent")]
    for competent_class in competent_classes:
        next_level = HierarchyNavigator.get_next_level(general_class, competent_class)
        if next_level is not None:
            level, model_key = next_level
            assert ModelConfig.get_model_level(model_key) == level


@pytest.mark.parametrize(
    ("level", "expected"),
    [(GENERAL, 0.85), (COMPETENT, 0.80), (EXPERT, 0.75)],
)
def test_confidence_thresholds_per_level(level, expected):
    assert HierarchyNavigator.get_threshold(level) == expected


# --- Terminal paths of a full prediction (fake models, one 640x640 patch) -------------------------


def classify(service) -> dict:
    return asyncio.run(service.predict_image(make_png(32, 32, value=100), "sample.png"))


# With a single patch, hybrid voting yields 0.6 + 0.4 * p for the top class p:
# p = 0.90 -> 0.96 (passes every threshold), p = 0.30 -> 0.72 (fails competent and expert).
PATHS = {
    "negative stops at general": (
        {"general": {"NEGATIVE": 0.95}},
        [], "NEGATIVE", "Negative", "general", None,
    ),
    "mitotic goes straight to expert": (
        {"general": {"MITOTIC": 0.95}, "mitotic_expert": {"MITOTIC_NUMA": 0.90}},
        [], "MITOTIC_NUMA", "Mitotic NuMA-like", "expert", None,
    ),
    "low-confidence mitotic expert falls back to general": (
        {"general": {"MITOTIC": 0.95}, "mitotic_expert": {"MITOTIC_NUMA": 0.30}},
        [], "MITOTIC", "Mitotic", "general", "Low confidence at expert level",
    ),
    "nuclear homogeneous stops at competent": (
        {"general": {"NUCLEAR": 0.95}, "nuclear_competent": {"NUCLEAR_HOMOGENEOUS": 0.90}},
        [], "NUCLEAR_HOMOGENEOUS", "Nuclear Homogeneous", "competent", None,
    ),
    "nuclear speckled has no expert model": (
        {"general": {"NUCLEAR": 0.95}, "nuclear_competent": {"NUCLEAR_SPECKLED": 0.90}},
        [], "NUCLEAR_SPECKLED", "Nuclear Speckled", "competent", "No expert model is available",
    ),
    "nucleolar reaches the nucleolar expert": (
        {"general": {"NUCLEAR": 0.95}, "nuclear_competent": {"NUCLEOLAR": 0.90},
         "nucleolar_expert": {"NUCLEOLAR_CLUMPY": 0.90}},
        [], "NUCLEOLAR_CLUMPY", "Nucleolar Clumpy", "expert", None,
    ),
    "low-confidence nucleolar expert falls back to competent": (
        {"general": {"NUCLEAR": 0.95}, "nuclear_competent": {"NUCLEOLAR": 0.90},
         "nucleolar_expert": {"NUCLEOLAR_CLUMPY": 0.30}},
        [], "NUCLEOLAR", "Nucleolar", "competent", "classified at competent level",
    ),
    "discrete dots is an expert-level pattern found at competent": (
        {"general": {"CYTOPLASMIC": 0.95}, "cytoplasmic_competent": {"CYTOPLASMIC_DISCRETE_DOTS": 0.90}},
        [], "CYTOPLASMIC_DISCRETE_DOTS", "Cytoplasmic Discrete Dots", "expert", "AC-18",
    ),
    "cytoplasmic speckled reaches its expert": (
        {"general": {"CYTOPLASMIC": 0.95}, "cytoplasmic_competent": {"CYTOPLASMIC_SPECKLED": 0.90},
         "cytoplasmic_speckled_expert": {"CYTOPLASMIC_FINE_SPECKLED": 0.90}},
        [], "CYTOPLASMIC_FINE_SPECKLED", "Cytoplasmic Fine Speckled", "expert", None,
    ),
    "missing expert model keeps the competent result": (
        {"general": {"CYTOPLASMIC": 0.95}, "cytoplasmic_competent": {"CYTOPLASMIC_SPECKLED": 0.90}},
        ["cytoplasmic_speckled_expert"], "CYTOPLASMIC_SPECKLED", "Cytoplasmic Speckled", "competent",
        "No expert model is available",
    ),
    "low-confidence competent falls back to general": (
        {"general": {"CYTOPLASMIC": 0.95}, "cytoplasmic_competent": {"CYTOPLASMIC_FIBRILLAR": 0.30}},
        [], "CYTOPLASMIC", "Cytoplasmic", "general", "classified at general level",
    ),
}


@pytest.mark.parametrize(
    ("scripts", "removed_models", "key", "display_name", "level", "note"),
    list(PATHS.values()),
    ids=list(PATHS),
)
def test_prediction_path(service, fake_models, scripts, removed_models, key, display_name, level, note):
    for model_key, class_probabilities in scripts.items():
        fake_models[model_key].script(probability_vector(model_key, **class_probabilities))
    for model_key in removed_models:
        fake_models.pop(model_key)

    result = classify(service)

    assert result["status"] == "success"
    assert result["prediction_key"] == key
    assert result["prediction"] == display_name
    assert result["classification_level"] == level
    if note is None:
        assert result["note"] is None
    else:
        assert note in result["note"]


# --- Threshold boundaries (levels stubbed with exact confidences) ---------------------------------


def level_result(prediction: str, confidence: float) -> dict:
    return {"prediction": prediction, "confidence": confidence,
            "confidence_percentage": round(confidence * 100, 2),
            "class_probabilities": {}, "patch_statistics": {}}


def run_hierarchy(service, monkeypatch, results: dict) -> dict:
    monkeypatch.setattr(service, "_predict_level", lambda patches, model_key, level: results[model_key])
    return service._hierarchical_classification([np.zeros((640, 640), dtype=np.uint8)])


@pytest.mark.parametrize(
    ("results", "key", "level"),
    [
        ({"general": level_result("NUCLEAR", 0.90),
          "nuclear_competent": level_result("NUCLEAR_HOMOGENEOUS", 0.80)},
         "NUCLEAR_HOMOGENEOUS", COMPETENT),
        ({"general": level_result("NUCLEAR", 0.90), "nuclear_competent": level_result("NUCLEOLAR", 0.90),
          "nucleolar_expert": level_result("NUCLEOLAR_CLUMPY", 0.75)},
         "NUCLEOLAR_CLUMPY", EXPERT),
        ({"general": level_result("MITOTIC", 0.90), "mitotic_expert": level_result("MITOTIC_NUMA", 0.75)},
         "MITOTIC_NUMA", EXPERT),
    ],
    ids=["competent at exactly 0.80", "expert at exactly 0.75", "mitotic expert at exactly 0.75"],
)
def test_confidence_exactly_at_the_threshold_keeps_the_level(service, monkeypatch, results, key, level):
    result = run_hierarchy(service, monkeypatch, results)

    assert result["final_key"] == key
    assert result["classification_level"] == level


def test_confidence_just_below_the_threshold_falls_back(service, monkeypatch):
    result = run_hierarchy(service, monkeypatch, {
        "general": level_result("NUCLEAR", 0.90),
        "nuclear_competent": level_result("NUCLEAR_HOMOGENEOUS", 0.7999),
    })

    assert result["final_key"] == "NUCLEAR"
    assert result["classification_level"] == GENERAL


@pytest.mark.parametrize(
    ("results", "key", "level"),
    [
        ({"general": level_result("NEGATIVE", 0.10)}, "NEGATIVE", GENERAL),
        ({"general": level_result("NUCLEAR", 0.10),
          "nuclear_competent": level_result("NUCLEAR_HOMOGENEOUS", 0.90)}, "NUCLEAR_HOMOGENEOUS", COMPETENT),
    ],
    ids=["negative", "nuclear"],
)
def test_general_level_is_never_rejected_by_its_threshold(service, monkeypatch, results, key, level):
    # The general threshold (0.85) is informational only: the general prediction is always
    # accepted and decides the next level, however low its confidence.
    result = run_hierarchy(service, monkeypatch, results)

    assert result["final_key"] == key
    assert result["classification_level"] == level
    assert result["note"] is None

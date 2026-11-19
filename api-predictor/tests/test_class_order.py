"""Class-index order of every checkpoint, checked without loading any checkpoint.

Each `ModelConfig.MODELS[*]['classes']` list is bound by index to the checkpoint's
output layer. The table below is the verified order (F1/F2 spec §3.1); a sorted,
reordered or edited list would silently mislabel every prediction.
"""

import pytest

from app.core.class_mapping import ClassificationLevel, HierarchyNavigator, ModelConfig

EXPECTED_CLASS_ORDER = {
    "general": ["CYTOPLASMIC", "MITOTIC", "NEGATIVE", "NUCLEAR"],
    "nuclear_competent": ["NUCLEAR_CENTROMERE", "NUCLEAR_SPECKLED", "NUCLEAR_DENSE_FINE_SPECKLED",
                          "NUCLEAR_HOMOGENEOUS", "NUCLEOLAR"],
    "cytoplasmic_competent": ["CYTOPLASMIC_POLAR_GOLGI", "CYTOPLASMIC_FIBRILLAR", "CYTOPLASMIC_SPECKLED",
                              "CYTOPLASMIC_DISCRETE_DOTS", "CYTOPLASMIC_RETICULAR_AMA"],
    "nucleolar_expert": ["NUCLEOLAR_CLUMPY", "NUCLEOLAR_HOMOGENEOUS", "NUCLEOLAR_PUNCTATE"],
    "cytoplasmic_speckled_expert": ["CYTOPLASMIC_FINE_SPECKLED", "CYTOPLASMIC_DENSE_FINE_SPECKLED"],
    "mitotic_expert": ["MITOTIC_SPINDLE_FIBERS", "MITOTIC_CENTROSOME", "MITOTIC_INTERCELLULAR_BRIDGE",
                       "MITOTIC_CHROMOSOMAL_ENVELOPE", "MITOTIC_NUMA"],
}

EXPECTED_LEVEL = {
    "general": ClassificationLevel.GENERAL,
    "nuclear_competent": ClassificationLevel.COMPETENT,
    "cytoplasmic_competent": ClassificationLevel.COMPETENT,
    "nucleolar_expert": ClassificationLevel.EXPERT,
    "cytoplasmic_speckled_expert": ClassificationLevel.EXPERT,
    "mitotic_expert": ClassificationLevel.EXPERT,
}


def test_the_six_expected_models_are_configured():
    assert list(ModelConfig.MODELS) == list(EXPECTED_CLASS_ORDER)


@pytest.mark.parametrize("model_key", list(EXPECTED_CLASS_ORDER))
def test_class_index_order_matches_the_checkpoint(model_key):
    assert ModelConfig.get_model_classes(model_key) == EXPECTED_CLASS_ORDER[model_key]


@pytest.mark.parametrize("model_key", list(EXPECTED_CLASS_ORDER))
def test_model_level(model_key):
    assert ModelConfig.get_model_level(model_key) == EXPECTED_LEVEL[model_key]


@pytest.mark.parametrize("model_key", list(EXPECTED_CLASS_ORDER))
def test_every_class_has_a_display_name_at_its_level(model_key):
    level = ModelConfig.get_model_level(model_key)
    for class_key in ModelConfig.get_model_classes(model_key):
        class_info = HierarchyNavigator.get_class_info(level, class_key)
        assert class_info is not None and class_info["name"], class_key

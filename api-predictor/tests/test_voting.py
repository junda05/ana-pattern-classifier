"""Hybrid voting over patch predictions: 60 % majority + 40 % confidence-weighted, MITOTIC rules."""

from collections import Counter

import numpy as np
import pytest

from app.core.class_mapping import ModelConfig
from tests.fakes import probability_vector


def documented_rule(predictions, confidences, probabilities, model_key):
    """The documented combination: 0.6 * majority share on the majority class
    plus 0.4 * confidence-weighted mean probabilities, renormalised."""
    classes = ModelConfig.get_model_classes(model_key)
    counts = Counter(predictions)
    majority_class, majority_votes = counts.most_common(1)[0]
    weights = np.asarray(confidences) / np.sum(confidences)
    combined = 0.4 * (weights[:, None] * np.asarray(probabilities)).sum(axis=0)
    combined[classes.index(majority_class)] += 0.6 * majority_votes / len(predictions)
    return combined / combined.sum()


def patch(model_key, **class_probabilities):
    """(predicted class, confidence, probability vector) of one patch."""
    vector = np.asarray(probability_vector(model_key, **class_probabilities))
    classes = ModelConfig.get_model_classes(model_key)
    top = int(np.argmax(vector))
    return classes[top], float(vector[top]), vector


def vote(service, model_key, patches):
    predictions, confidences, probabilities = (list(column) for column in zip(*patches, strict=True))
    return service._hybrid_voting(predictions, confidences, probabilities, model_key), (
        predictions, confidences, probabilities)


# --- Majority and confidence-weighted combination -------------------------------------------------


def test_unanimous_patches_combine_to_the_documented_confidence(service):
    patches = [patch("nuclear_competent", NUCLEAR_HOMOGENEOUS=0.90)] * 3

    (final_class, confidence, final_probabilities), inputs = vote(service, "nuclear_competent", patches)

    assert final_class == "NUCLEAR_HOMOGENEOUS"
    assert confidence == pytest.approx(0.6 + 0.4 * 0.90)
    assert final_probabilities.sum() == pytest.approx(1.0)
    np.testing.assert_allclose(final_probabilities, documented_rule(*inputs, "nuclear_competent"))


def test_majority_outweighs_a_confidence_weighted_average_that_favours_another_class(service):
    patches = [
        patch("nuclear_competent", NUCLEAR_HOMOGENEOUS=0.40, NUCLEAR_CENTROMERE=0.38),
        patch("nuclear_competent", NUCLEAR_HOMOGENEOUS=0.40, NUCLEAR_CENTROMERE=0.38),
        patch("nuclear_competent", NUCLEAR_CENTROMERE=0.99),
    ]

    (final_class, confidence, final_probabilities), inputs = vote(service, "nuclear_competent", patches)

    # On its own, the confidence-weighted average would pick NUCLEAR_CENTROMERE ...
    weights = np.asarray(inputs[1]) / np.sum(inputs[1])
    weighted_only = (weights[:, None] * np.asarray(inputs[2])).sum(axis=0)
    classes = ModelConfig.get_model_classes("nuclear_competent")
    assert classes[int(np.argmax(weighted_only))] == "NUCLEAR_CENTROMERE"
    # ... but the 2/3 majority carries 60 % of the decision
    assert final_class == "NUCLEAR_HOMOGENEOUS"
    np.testing.assert_allclose(final_probabilities, documented_rule(*inputs, "nuclear_competent"))
    assert confidence == pytest.approx(float(np.max(final_probabilities)))


def test_confidence_weighted_average_overturns_a_tied_vote(service):
    patches = [
        patch("nuclear_competent", NUCLEAR_HOMOGENEOUS=0.34, NUCLEAR_CENTROMERE=0.33, NUCLEOLAR=0.33),
        patch("nuclear_competent", NUCLEAR_CENTROMERE=0.99),
        patch("nuclear_competent", NUCLEOLAR=0.50, NUCLEAR_CENTROMERE=0.49),
    ]

    (final_class, _, final_probabilities), inputs = vote(service, "nuclear_competent", patches)

    # Three-way tie: the majority step picks the first class seen (NUCLEAR_HOMOGENEOUS),
    # yet the confidence-weighted 40 % decides for NUCLEAR_CENTROMERE
    assert Counter(inputs[0]).most_common(1)[0][0] == "NUCLEAR_HOMOGENEOUS"
    assert final_class == "NUCLEAR_CENTROMERE"
    np.testing.assert_allclose(final_probabilities, documented_rule(*inputs, "nuclear_competent"))


# --- MITOTIC rare-class rules (general model only) -------------------------------------------------

NUCLEAR_PATCH = ("NUCLEAR", 0.90, np.asarray(probability_vector("general", NUCLEAR=0.90, MITOTIC=0.02)))


@pytest.mark.parametrize("mitotic_probability", [0.70, 0.72, 0.95])
def test_a_single_patch_with_mitotic_at_least_70_percent_wins(service, mitotic_probability):
    mitotic_patch = patch("general", MITOTIC=mitotic_probability)
    patches = [NUCLEAR_PATCH, NUCLEAR_PATCH, NUCLEAR_PATCH, mitotic_patch]

    (final_class, confidence, final_probabilities), _ = vote(service, "general", patches)

    assert final_class == "MITOTIC"
    assert confidence == pytest.approx(mitotic_probability)
    np.testing.assert_allclose(final_probabilities, mitotic_patch[2])


def test_a_single_patch_below_70_percent_does_not_trigger_the_mitotic_rule(service):
    patches = [NUCLEAR_PATCH, NUCLEAR_PATCH, NUCLEAR_PATCH, patch("general", MITOTIC=0.65)]

    (final_class, _, _), _ = vote(service, "general", patches)

    assert final_class == "NUCLEAR"


def test_two_moderate_mitotic_patches_averaging_at_least_50_percent_win(service):
    weaker = ("NUCLEAR", 0.50, np.asarray(probability_vector("general", MITOTIC=0.48, NUCLEAR=0.50)))
    stronger = patch("general", MITOTIC=0.60, NUCLEAR=0.38)
    patches = [NUCLEAR_PATCH, NUCLEAR_PATCH, NUCLEAR_PATCH, weaker, stronger]

    (final_class, confidence, final_probabilities), _ = vote(service, "general", patches)

    assert final_class == "MITOTIC"
    assert confidence == pytest.approx((0.48 + 0.60) / 2)
    np.testing.assert_allclose(final_probabilities, stronger[2])  # the strongest evidence patch


def test_moderate_mitotic_patches_averaging_exactly_50_percent_win(service):
    first = ("NUCLEAR", 0.50, np.asarray(probability_vector("general", MITOTIC=0.45, NUCLEAR=0.50)))
    second = patch("general", MITOTIC=0.55, NUCLEAR=0.40)
    patches = [NUCLEAR_PATCH, NUCLEAR_PATCH, NUCLEAR_PATCH, first, second]

    (final_class, confidence, _), _ = vote(service, "general", patches)

    assert final_class == "MITOTIC"
    assert confidence == pytest.approx(0.50)


def test_moderate_mitotic_patches_averaging_below_50_percent_do_not_win(service):
    first = ("NUCLEAR", 0.60, np.asarray(probability_vector("general", MITOTIC=0.35, NUCLEAR=0.60)))
    second = ("NUCLEAR", 0.50, np.asarray(probability_vector("general", MITOTIC=0.45, NUCLEAR=0.50)))
    patches = [NUCLEAR_PATCH, NUCLEAR_PATCH, first, second]

    (final_class, _, _), _ = vote(service, "general", patches)

    assert final_class == "NUCLEAR"


def test_exactly_30_percent_is_not_moderate_mitotic_evidence(service):
    borderline = ("NUCLEAR", 0.60, np.asarray(probability_vector("general", MITOTIC=0.30, NUCLEAR=0.60)))
    moderate = patch("general", MITOTIC=0.65, NUCLEAR=0.30)
    patches = [NUCLEAR_PATCH, borderline, moderate, moderate]

    (final_class, confidence, _), _ = vote(service, "general", patches)

    assert final_class == "MITOTIC"
    assert confidence == pytest.approx(0.65)  # mean over the two 0.65 patches only


def test_a_30_percent_patch_does_not_count_towards_the_two_patch_minimum(service):
    borderline = ("NUCLEAR", 0.60, np.asarray(probability_vector("general", MITOTIC=0.30, NUCLEAR=0.60)))
    moderate = patch("general", MITOTIC=0.65, NUCLEAR=0.30)
    patches = [NUCLEAR_PATCH, NUCLEAR_PATCH, borderline, moderate]

    (final_class, _, _), _ = vote(service, "general", patches)

    assert final_class == "NUCLEAR"


def test_expert_models_use_plain_hybrid_voting(service):
    patches = [
        patch("mitotic_expert", MITOTIC_NUMA=0.90),
        patch("mitotic_expert", MITOTIC_NUMA=0.90),
        patch("mitotic_expert", MITOTIC_CENTROSOME=0.72),
    ]

    (final_class, _, final_probabilities), inputs = vote(service, "mitotic_expert", patches)

    assert final_class == "MITOTIC_NUMA"
    np.testing.assert_allclose(final_probabilities, documented_rule(*inputs, "mitotic_expert"))

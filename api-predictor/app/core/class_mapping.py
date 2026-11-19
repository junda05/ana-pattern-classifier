"""
Hierarchical ICAP class mapping for ANA pattern classification
Structure: General → Competent → Expert
"""

from enum import StrEnum


class ClassificationLevel(StrEnum):
    """Hierarchical classification levels (str() and f-strings give the value)"""
    GENERAL = "general"
    COMPETENT = "competent"
    EXPERT = "expert"


class ThresholdConfig:
    """Confidence thresholds per classification level"""
    GENERAL = 0.85
    COMPETENT = 0.80
    EXPERT = 0.75


# CLASS TO AC CODE AND DISPLAY NAME MAPPING

class ACMapping:
    """Maps model classes to AC codes and display names"""

    # General level
    GENERAL = {
        'NEGATIVE': {
            'ac_code': 'AC-0',
            'name': 'Negative',
            'has_competent': False,
            'has_expert': False
        },
        'NUCLEAR': {
            'ac_code': 'AC-1 to AC-14, AC-29',
            'name': 'Nuclear',
            'has_competent': True,
            'has_expert': False  # Some subclasses have an expert level; decided at competent level
        },
        'CYTOPLASMIC': {
            'ac_code': 'AC-15 to AC-23',
            'name': 'Cytoplasmic',
            'has_competent': True,
            'has_expert': False  # Some subclasses have an expert level; decided at competent level
        },
        'MITOTIC': {
            'ac_code': 'AC-24 to AC-28',
            'name': 'Mitotic',
            'has_competent': False,  # Goes straight to the expert level
            'has_expert': True
        }
    }

    # Competent level - Nuclear
    NUCLEAR_COMPETENT = {
        'NUCLEAR_HOMOGENEOUS': {
            'ac_code': 'AC-1',
            'name': 'Nuclear Homogeneous',
            'has_expert': False
        },
        'NUCLEAR_DENSE_FINE_SPECKLED': {
            'ac_code': 'AC-2',
            'name': 'Nuclear Dense Fine Speckled',
            'has_expert': False
        },
        'NUCLEAR_CENTROMERE': {
            'ac_code': 'AC-3',
            'name': 'Nuclear Centromere',
            'has_expert': False
        },
        'NUCLEAR_SPECKLED': {
            'ac_code': 'AC-4/AC-5',
            'name': 'Nuclear Speckled',
            'has_expert': False,  # An expert level exists but was NOT trained
            'note': 'No expert model is available for this class'
        },
        'NUCLEOLAR': {
            'ac_code': 'AC-8 to AC-10',
            'name': 'Nucleolar',
            'has_expert': True
        }
    }

    # Competent level - Cytoplasmic
    CYTOPLASMIC_COMPETENT = {
        'CYTOPLASMIC_FIBRILLAR': {
            'ac_code': 'AC-15/AC-16/AC-17',
            'name': 'Cytoplasmic Fibrillar',
            'has_expert': False,  # An expert level exists but was NOT trained
            'note': 'No expert model is available for this class'
        },
        'CYTOPLASMIC_DISCRETE_DOTS': {
            'ac_code': 'AC-18',
            'name': 'Cytoplasmic Discrete Dots',
            'has_expert': False,  # IS an expert-level class but is detected by the competent model
            'is_expert_level': True,  # Special flag for AC-18
            'note': 'AC-18 is an expert-level pattern detected by the competent model'
        },
        'CYTOPLASMIC_SPECKLED': {
            'ac_code': 'AC-19/AC-20',
            'name': 'Cytoplasmic Speckled',
            'has_expert': True
        },
        'CYTOPLASMIC_RETICULAR_AMA': {
            'ac_code': 'AC-21',
            'name': 'Cytoplasmic Reticular/AMA',
            'has_expert': False
        },
        'CYTOPLASMIC_POLAR_GOLGI': {
            'ac_code': 'AC-22',
            'name': 'Cytoplasmic Polar/Golgi-like',
            'has_expert': False
        }
    }

    # Expert level - Nucleolar
    NUCLEOLAR_EXPERT = {
        'NUCLEOLAR_HOMOGENEOUS': {
            'ac_code': 'AC-8',
            'name': 'Nucleolar Homogeneous'
        },
        'NUCLEOLAR_CLUMPY': {
            'ac_code': 'AC-9',
            'name': 'Nucleolar Clumpy'
        },
        'NUCLEOLAR_PUNCTATE': {
            'ac_code': 'AC-10',
            'name': 'Nucleolar Punctate'
        }
    }

    # Expert level - Cytoplasmic Speckled
    CYTOPLASMIC_SPECKLED_EXPERT = {
        'CYTOPLASMIC_DENSE_FINE_SPECKLED': {
            'ac_code': 'AC-19',
            'name': 'Cytoplasmic Dense Fine Speckled'
        },
        'CYTOPLASMIC_FINE_SPECKLED': {
            'ac_code': 'AC-20',
            'name': 'Cytoplasmic Fine Speckled'
        }
    }

    # Expert level - Mitotic
    MITOTIC_EXPERT = {
        'MITOTIC_CENTROSOME': {
            'ac_code': 'AC-24',
            'name': 'Mitotic Centrosome'
        },
        'MITOTIC_SPINDLE_FIBERS': {
            'ac_code': 'AC-25',
            'name': 'Mitotic Spindle Fibers'
        },
        'MITOTIC_NUMA': {
            'ac_code': 'AC-26',
            'name': 'Mitotic NuMA-like'
        },
        'MITOTIC_INTERCELLULAR_BRIDGE': {
            'ac_code': 'AC-27',
            'name': 'Mitotic Intercellular Bridge'
        },
        'MITOTIC_CHROMOSOMAL_ENVELOPE': {
            'ac_code': 'AC-28',
            'name': 'Mitotic Chromosomal Envelope'
        }
    }


# HIERARCHY NAVIGATION

class HierarchyNavigator:
    """Navigates the hierarchical classification structure"""

    @staticmethod
    def get_next_level(general_class: str,
                       competent_class: str | None = None) -> tuple[ClassificationLevel, str] | None:
        """
        Determine the next classification level

        Args:
            general_class: Class predicted at the general level
            competent_class: Class predicted at the competent level (optional)

        Returns:
            Tuple (level, model) or None if there is no next level
            Examples:
            - ('competent', 'nuclear_competent')
            - ('expert', 'nucleolar_expert')
            - None
        """
        general_info = ACMapping.GENERAL.get(general_class)

        if not general_info:
            return None

        # At the general level
        if competent_class is None:
            # Negative has no lower level
            if general_class == 'NEGATIVE':
                return None

            # Mitotic goes straight to expert (no competent level)
            if general_class == 'MITOTIC':
                if general_info['has_expert']:
                    return (ClassificationLevel.EXPERT, 'mitotic_expert')
                return None

            # Nuclear and Cytoplasmic go to the competent level
            if general_class == 'NUCLEAR' and general_info['has_competent']:
                return (ClassificationLevel.COMPETENT, 'nuclear_competent')

            if general_class == 'CYTOPLASMIC' and general_info['has_competent']:
                return (ClassificationLevel.COMPETENT, 'cytoplasmic_competent')

            return None

        # At the competent level: decide whether an expert level exists
        if general_class == 'NUCLEAR':
            competent_info = ACMapping.NUCLEAR_COMPETENT.get(competent_class)
            if competent_info and competent_info.get('has_expert'):
                # Only NUCLEOLAR has a trained expert model
                if competent_class == 'NUCLEOLAR':
                    return (ClassificationLevel.EXPERT, 'nucleolar_expert')
            return None

        if general_class == 'CYTOPLASMIC':
            competent_info = ACMapping.CYTOPLASMIC_COMPETENT.get(competent_class)
            if competent_info:
                # AC-18 is a special case: expert-level pattern already reached at competent level
                if competent_info.get('is_expert_level'):
                    return None

                # Only CYTOPLASMIC_SPECKLED has a trained expert model
                if competent_info.get('has_expert') and competent_class == 'CYTOPLASMIC_SPECKLED':
                    return (ClassificationLevel.EXPERT, 'cytoplasmic_speckled_expert')
            return None

        return None

    @staticmethod
    def get_class_info(level: ClassificationLevel, class_name: str) -> dict | None:
        """
        Get the full information of a class

        Args:
            level: Classification level
            class_name: Model class key

        Returns:
            Dictionary with the class information, or None
        """
        mapping = {
            ClassificationLevel.GENERAL: ACMapping.GENERAL,
            ClassificationLevel.COMPETENT: {
                **ACMapping.NUCLEAR_COMPETENT,
                **ACMapping.CYTOPLASMIC_COMPETENT
            },
            ClassificationLevel.EXPERT: {
                **ACMapping.NUCLEOLAR_EXPERT,
                **ACMapping.CYTOPLASMIC_SPECKLED_EXPERT,
                **ACMapping.MITOTIC_EXPERT
            }
        }

        return mapping.get(level, {}).get(class_name)

    @staticmethod
    def format_final_prediction(level: ClassificationLevel, class_name: str) -> str:
        """
        Format the final prediction without the AC code

        FORMATTING RULES:
        - All levels (GENERAL, COMPETENT, EXPERT): display name only, no AC code

        Args:
            level: Classification level reached
            class_name: Predicted class key

        Returns:
            Formatted string (display name only)
        """
        class_info = HierarchyNavigator.get_class_info(level, class_name)

        if not class_info:
            return class_name

        name = class_info.get('name', class_name)

        # Always return the display name only, without the AC code
        return name

    @staticmethod
    def get_threshold(level: ClassificationLevel) -> float:
        """
        Get the threshold for a given level

        Args:
            level: Classification level

        Returns:
            Threshold value
        """
        thresholds = {
            ClassificationLevel.GENERAL: ThresholdConfig.GENERAL,
            ClassificationLevel.COMPETENT: ThresholdConfig.COMPETENT,
            ClassificationLevel.EXPERT: ThresholdConfig.EXPERT
        }

        return thresholds.get(level, 0.80)


# MODEL CONFIGURATION

class ModelConfig:
    """Model paths and classes.

    Each 'classes' list is bound by index to the checkpoint's output layer.
    Never sort, reorder, add or drop elements.
    """

    MODELS = {
        'general': {
            'path': 'models/best_general.pt',
            'classes': ['CYTOPLASMIC', 'MITOTIC', 'NEGATIVE', 'NUCLEAR'],
            'level': ClassificationLevel.GENERAL
        },
        'nuclear_competent': {
            'path': 'models/best_nuclear_competent.pt',
            'classes': ['NUCLEAR_CENTROMERE', 'NUCLEAR_SPECKLED', 'NUCLEAR_DENSE_FINE_SPECKLED',
                       'NUCLEAR_HOMOGENEOUS', 'NUCLEOLAR'],
            'level': ClassificationLevel.COMPETENT
        },
        'cytoplasmic_competent': {
            'path': 'models/best_cytoplasmic_competent.pt',
            'classes': ['CYTOPLASMIC_POLAR_GOLGI', 'CYTOPLASMIC_FIBRILLAR',
                       'CYTOPLASMIC_SPECKLED', 'CYTOPLASMIC_DISCRETE_DOTS',
                       'CYTOPLASMIC_RETICULAR_AMA'],
            'level': ClassificationLevel.COMPETENT
        },
        'nucleolar_expert': {
            'path': 'models/best_nucleolar_expert.pt',
            'classes': ['NUCLEOLAR_CLUMPY', 'NUCLEOLAR_HOMOGENEOUS', 'NUCLEOLAR_PUNCTATE'],
            'level': ClassificationLevel.EXPERT
        },
        'cytoplasmic_speckled_expert': {
            'path': 'models/best_cytoplasmic_speckled_expert.pt',
            'classes': ['CYTOPLASMIC_FINE_SPECKLED', 'CYTOPLASMIC_DENSE_FINE_SPECKLED'],
            'level': ClassificationLevel.EXPERT
        },
        'mitotic_expert': {
            'path': 'models/best_mitotic_expert.pt',
            'classes': ['MITOTIC_SPINDLE_FIBERS', 'MITOTIC_CENTROSOME', 'MITOTIC_INTERCELLULAR_BRIDGE',
                       'MITOTIC_CHROMOSOMAL_ENVELOPE', 'MITOTIC_NUMA'],
            'level': ClassificationLevel.EXPERT
        }
    }

    @staticmethod
    def get_model_path(model_key: str) -> str:
        """Get a model's path"""
        return ModelConfig.MODELS.get(model_key, {}).get('path', '')

    @staticmethod
    def get_model_classes(model_key: str) -> list[str]:
        """Get a model's classes"""
        return ModelConfig.MODELS.get(model_key, {}).get('classes', [])

    @staticmethod
    def get_model_level(model_key: str) -> ClassificationLevel:
        """Get a model's classification level"""
        return ModelConfig.MODELS.get(model_key, {}).get('level', ClassificationLevel.GENERAL)

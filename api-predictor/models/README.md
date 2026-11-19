# Model checkpoints

The prediction service classifies HEp-2 indirect immunofluorescence (IIF) images with six
YOLOv8 image-classification checkpoints (`YOLOv8-cls`, trained with Ultralytics 8.3.179 and
loaded with Ultralytics 8.3.198). The checkpoints are not included in the repository because of
their size (over 600 MB together with the training notebooks); copy them into this folder with
exactly these names:

```text
api-predictor/models/
├── best_general.pt
├── best_nuclear_competent.pt
├── best_cytoplasmic_competent.pt
├── best_nucleolar_expert.pt
├── best_cytoplasmic_speckled_expert.pt
└── best_mitotic_expert.pt
```

- **Local development:** the service resolves the paths relative to `api-predictor/`
  (`ModelConfig.MODELS[*]['path']` in `app/core/class_mapping.py`), whatever the working directory.
- **Container:** the image does not contain the checkpoints. Mount this folder read-only at
  `/app/models`, for example `docker run -v "$PWD/models:/app/models:ro" ...`; the root
  `docker-compose.yml` does this for you.

The checkpoints load once at startup. A missing or unreadable checkpoint is logged and skipped:

- Without `best_general.pt` the service stays up but cannot classify:
  `GET /api/v1/health` and `POST /api/v1/predict` answer `503`.
- Without a lower-level checkpoint, images that need it stop at the level above, and the
  response `note` reads "No competent model is available for this class" or
  "No expert model is available for this class".

## The six checkpoints

Input: 640 × 640 patches. Each image is converted to its green channel, enhanced with CLAHE and a
3 × 3 Gaussian blur, and cut into 640 × 640 patches with 40 % overlap. Every patch is written as an
8-bit grayscale PNG and classified by the checkpoint. See
[docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#3-classification-pipeline-api-predictor) for the full pipeline.

| File | Model key | Level | Output classes, **in index order** (index 0 first) |
|---|---|---|---|
| `best_general.pt` | `general` | general | `CYTOPLASMIC`, `MITOTIC`, `NEGATIVE`, `NUCLEAR` |
| `best_nuclear_competent.pt` | `nuclear_competent` | competent | `NUCLEAR_CENTROMERE`, `NUCLEAR_SPECKLED`, `NUCLEAR_DENSE_FINE_SPECKLED`, `NUCLEAR_HOMOGENEOUS`, `NUCLEOLAR` |
| `best_cytoplasmic_competent.pt` | `cytoplasmic_competent` | competent | `CYTOPLASMIC_POLAR_GOLGI`, `CYTOPLASMIC_FIBRILLAR`, `CYTOPLASMIC_SPECKLED`, `CYTOPLASMIC_DISCRETE_DOTS`, `CYTOPLASMIC_RETICULAR_AMA` |
| `best_nucleolar_expert.pt` | `nucleolar_expert` | expert | `NUCLEOLAR_CLUMPY`, `NUCLEOLAR_HOMOGENEOUS`, `NUCLEOLAR_PUNCTATE` |
| `best_cytoplasmic_speckled_expert.pt` | `cytoplasmic_speckled_expert` | expert | `CYTOPLASMIC_FINE_SPECKLED`, `CYTOPLASMIC_DENSE_FINE_SPECKLED` |
| `best_mitotic_expert.pt` | `mitotic_expert` | expert | `MITOTIC_SPINDLE_FIBERS`, `MITOTIC_CENTROSOME`, `MITOTIC_INTERCELLULAR_BRIDGE`, `MITOTIC_CHROMOSOMAL_ENVELOPE`, `MITOTIC_NUMA` |

Which checkpoint runs after which one:

- `general` → `NUCLEAR` → `nuclear_competent`; `CYTOPLASMIC` → `cytoplasmic_competent`;
  `MITOTIC` → `mitotic_expert` (there is no mitotic competent model); `NEGATIVE` stops.
- `nuclear_competent` → `NUCLEOLAR` → `nucleolar_expert`; every other nuclear class stops.
- `cytoplasmic_competent` → `CYTOPLASMIC_SPECKLED` → `cytoplasmic_speckled_expert`;
  `CYTOPLASMIC_DISCRETE_DOTS` (AC-18) is reported as an expert-level result; every other
  cytoplasmic class stops.

## Class order must not change

A checkpoint's output is a vector of probabilities; the service turns the index of the winning
entry into a class key through the `classes` list of `ModelConfig.MODELS` in
`app/core/class_mapping.py`. Each checkpoint also stores labels in its metadata
(`model.names`); in the copies included here they equal the lists above,
index by index, but the service never reads them. Therefore:

- Never sort, reorder, rename, add or remove entries of a `classes` list. Any change silently
  mislabels every prediction of that model.
- When a checkpoint is retrained or replaced, keep its output order, or update its `classes`
  list to the new index order in the same change.
- `tests/test_class_order.py` pins the order above and fails if a list is edited.

To inspect the labels stored in a checkpoint:

```bash
cd api-predictor
python -c "from ultralytics import YOLO; print(YOLO('models/best_general.pt').names)"
# {0: 'CYTOPLASMIC', 1: 'MITOTIC', 2: 'NEGATIVE', 3: 'NUCLEAR'}
```

The class keys are the same strings the API stores (`PredictionClass` in
`api/src/entities/results/result.types.ts`) and the web app displays through
`frontend/src/config/classMapping.js`.

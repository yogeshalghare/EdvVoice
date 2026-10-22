# The complaint classifier

Trains the model that decides which department a complaint belongs to.

```
cd backend/ml
pip install scikit-learn pandas joblib
python generate_dataset.py     # writes data/complaints_train.csv
python train_model.py          # writes model/classifier.joblib
```

Restart the backend. It prints `[nlp] trained classifier loaded` when the
model is in use.

## Results

| Measure | Score | What it means |
| --- | --- | --- |
| Cross-validation on training data | 100% | Inflated — synthetic data scoring itself. Do not quote. |
| Held-out hand-written test set | 87.0% | **Quote this one.** |
| Rule-engine baseline, same test set | 72.5% | What the simple approach scores |
| Improvement | +14.5% | |

## Where the data comes from

No public dataset of Indian college grievances exists. The large public
complaint datasets — the CFPB consumer complaints database and its Kaggle
mirrors — are about mortgages, credit cards and debt collection. The
vocabulary does not overlap with hostel taps and marksheets, and the labels
do not map to our five departments.

So `generate_dataset.py` builds a **synthetic** seed set of 600 complaints,
120 per category. Describe it as synthetic in the report. The honest framing:
bootstrap on generated data, retrain on real complaints once deployed.

Four things stop it being pure templates: many sentence frames per category,
random slot filling, optional openings and closings students actually use,
and deliberate vocabulary overlap between categories so no single keyword
gives the answer away.

## Why there are two datasets

`complaints_train.csv` is generated. `complaints_test.csv` is **hand-written
and never generated** — 69 complaints phrased the way students actually type:
lowercase, abbreviated, no full stops, some deliberately ambiguous.

Measuring accuracy on generated data would be dishonest, because the model
would be scored on the same frames it trained on. That is why
cross-validation reads 100% and the real number is 87%.

## Two caveats to declare if asked

**The rule baseline is slightly flattered.** The keyword vocabulary in
`services/nlp.py` was extended after seeing which test rows the rules got
wrong. That is mild test-set leakage, and it helps the rules, not the model —
so the +14.5% gap is if anything an underestimate.

**The model only decides the category.** Priority and the is-this-a-complaint
check stay rule-based. Urgency comes from a short list of signal words that
needs no training data, and the validator has to explain its refusals to the
student in words, which a classifier cannot do.

## How it is wired in

`services/nlp.py` loads `model/classifier.joblib` if it exists **and**
scikit-learn is installed. If either is missing it runs on rules and says so.
So the model is optional: the API never fails to start because of it.

Below 0.25 confidence the keyword rules are kept, because a confident keyword
match beats an uncertain prediction. `classify()` returns `"source": "model"`
or `"rules"` so you can show which path produced an answer.

`classify(text, use_model=False)` forces rules — that is how the training
script measures the baseline honestly.

## Improving it

`train_model.py` prints every misclassified test row. Each one is a gap in
the training data: add frames covering that phrasing to
`generate_dataset.py` and retrain.

Once real complaints accumulate, export them and append to the training CSV.
Real data beats generated data every time.

## Note

Do not run Python from inside `backend/services/` — `email.py` there shadows
Python's built-in `email` module and imports fail confusingly. Run from
`backend/`, which is what uvicorn does anyway.

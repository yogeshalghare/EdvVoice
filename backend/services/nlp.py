"""
Complaint understanding.

Three jobs, in the order they run:

    validate()  — is this actually a complaint, or a test recording?
    classify()  — which department, and how urgent?
    summarise() — a short title for lists and tables

Everything here is rule-based: word lists, weighted scoring and a few
heuristics. That is a deliberate choice, not a placeholder. It is fast, needs
no model download, runs offline, and — the part that matters in a viva — you
can explain exactly why any given complaint was classified the way it was.

Three things make it more than naive keyword matching:

  1. Whole-word matching. Plain substring search classifies "the fantastic
     library" as Infrastructure because "fantastic" contains "fan", and "I
     feel the teaching is good" as Academic because "feel" contains "fee".
     Every term is matched on word boundaries instead.

  2. Phrase weighting. "water supply" is far more telling than "water", so
     longer phrases score higher than single words.

  3. Negation. "this is not urgent" must not come out as Urgent. Signal words
     preceded by a negation inside a short window are ignored.

A trained classifier can take over the category decision: if
ml/model/classifier.joblib exists AND scikit-learn is installed, classify()
uses it and falls back to the rules otherwise. Priority and validate() stay
rule-based either way — urgency is driven by a short list of signal words
that needs no training data, and validation needs to explain its refusals
to the student in words.

Train the model with:  cd ml && python generate_dataset.py && python train_model.py
"""

import re
from collections import Counter
from functools import lru_cache
from pathlib import Path

PRIORITIES = ["Low", "Normal", "High", "Urgent"]

# --------------------------------------------------------------------------
# Category vocabulary
# --------------------------------------------------------------------------

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Hostel": [
        "hostel", "warden", "roommate", "room mate", "washroom", "bathroom",
        "water supply", "no water", "geyser", "hot water", "cold water",
        "laundry", "cot", "bed", "mattress", "bedsheet", "hostel gate",
        "curfew", "accommodation", "dormitory", "common room", "hostel room",
        "water tank", "drainage", "mosquito", "rodents", "roommate issue",
        "hostel mess", "night out", "visitor", "hostel fee",
    ],
    "Infrastructure": [
        "classroom", "fan", "ceiling fan", "light", "tube light", "bulb",
        "air conditioner", "ac unit", "projector", "bench", "desk", "chair",
        "lift", "elevator", "staircase", "building", "toilet", "washbasin",
        "drinking water", "water cooler", "parking", "leakage", "leaking",
        "seepage", "broken", "damaged", "cracked", "out of order", "repair",
        "maintenance", "cleanliness", "garbage", "dustbin", "sweeper",
        "power cut", "electricity", "wiring", "socket", "switch board",
        "ventilation", "window", "door", "blackboard", "whiteboard",
    ],
    "Academic": [
        "exam", "examination", "marksheet", "mark sheet", "result", "results",
        "attendance", "syllabus", "lecture", "teacher", "faculty", "professor",
        "assignment", "practical", "laboratory", "grade", "grading",
        "revaluation", "re evaluation", "timetable", "time table",
        "admit card", "hall ticket", "subject", "course", "credit", "backlog",
        "scholarship", "fee", "fees", "admission", "certificate", "transcript",
        "internal marks", "viva", "seminar", "project guide", "submission",
        "question paper", "answer sheet", "semester",
    ],
    "Dining": [
        "mess", "canteen", "cafeteria", "food", "meal", "breakfast", "lunch",
        "dinner", "hygiene", "stale", "spoiled", "cockroach", "insect", "menu",
        "taste", "quality of food", "tiffin", "food poisoning", "undercooked",
        "raw food", "mess bill", "mess timing", "serving", "oily", "unclean plates",
        # Students name the dish rather than saying "food". Without these,
        # "roti was hard and could not be eaten" is not recognised at all.
        "roti", "chapati", "rice", "dal", "sabzi", "curry", "paneer", "snacks",
        "tea", "coffee", "milk", "egg", "chicken", "plate", "thali", "poha",
        "idli", "dosa", "samosa", "juice", "water cooler", "kitchen", "cook",
        "hair in", "stale food", "cold food", "hungry",
    ],
    "IT Support": [
        "wifi", "wi-fi", "internet", "network", "portal", "login", "password",
        "erp", "server", "website", "computer", "printer", "software", "lan",
        "connectivity", "disconnect", "disconnecting", "slow speed",
        "account locked", "email id", "online portal", "student portal",
        "system crash", "not loading", "page error", "bandwidth",
    ],
}

# --------------------------------------------------------------------------
# Priority signals
# --------------------------------------------------------------------------

URGENT_SIGNALS = [
    "urgent", "urgently", "emergency", "immediately", "danger", "dangerous",
    "unsafe", "fire", "injury", "injured", "shock", "electric shock",
    "harassment", "ragging", "bullying", "threat", "threatened", "medical",
    "accident", "flooded", "collapse", "short circuit", "gas leak", "theft",
    "stolen", "assault", "unconscious", "bleeding", "life risk",
]

HIGH_SIGNALS = [
    "repeatedly", "again and again", "many times", "several days",
    "several weeks", "for a week", "for days", "for three days", "still not",
    "no response", "ignored", "no action", "exam tomorrow", "deadline",
    "last date", "health", "sick", "ill", "unhygienic", "infection",
    "every day", "daily", "since monday", "since last week", "third time",
]

LOW_SIGNALS = [
    "suggestion", "suggest", "would be nice", "minor", "whenever possible",
    "if possible", "request to consider", "small issue", "not urgent",
    "no hurry", "at your convenience", "just an idea",
]

# Words that flip the meaning of a signal that follows them.
NEGATIONS = ["not", "no", "never", "isn't", "wasn't", "doesn't", "don't", "without"]
NEGATION_WINDOW = 3  # words

# --------------------------------------------------------------------------
# Complaint signals
# --------------------------------------------------------------------------

GRIEVANCE_SIGNALS = [
    "not working", "not able", "unable", "doesn't work", "does not work",
    "broken", "damaged", "problem", "issue", "complaint", "complain",
    "not getting", "no water", "no light", "no power", "not available",
    "delay", "delayed", "pending", "missing", "lost", "wrong", "incorrect",
    "poor", "bad", "dirty", "unhygienic", "stale", "slow", "faulty",
    "please", "request", "kindly", "need", "should be", "has not",
    "haven't", "hasn't", "didn't", "did not", "never", "refused", "denied",
    "ignored", "struggling", "difficulty", "trouble", "suffering",
    "harassment", "not clean", "out of order", "stopped", "failed", "error",
    "unfair", "not received", "still waiting", "no response", "overcharged",
    "hard", "cold", "stale", "smell", "smells", "leaking", "leak", "blocked",
    "noisy", "noise", "crowded", "late", "waiting", "stuck", "cannot", "can't",
    "not able to", "rude", "ignoring", "useless", "worst", "very bad",
    "disturb", "disturbing", "shortage", "insufficient", "not enough",
]

TEST_PHRASES = [
    "testing", "test test", "mic test", "hello hello", "check check",
    "one two three", "can you hear me", "is this working", "hello world",
    "sound check", "blah blah", "la la la", "mic check",
]

# Filler that carries no meaning on its own.
FILLER = {
    "hello", "hi", "hey", "good", "morning", "evening", "afternoon",
    "namaste", "ok", "okay", "yes", "no", "thanks", "thank", "you", "a",
    "an", "the", "um", "uh", "so", "well", "actually", "basically",
}

# Openings people say before getting to the point — stripped from titles.
TITLE_PREFIXES = [
    "i want to complain about", "i want to complain that", "i would like to complain about",
    "i would like to report that", "i would like to report", "i want to report that",
    "i want to report", "i am writing to complain about", "my complaint is that",
    "my complaint is", "i have a complaint about", "i have a complaint",
    "this is to inform that", "i wish to inform that", "please note that",
    "i want to say that", "there is a problem with", "the problem is that",
    "the issue is that", "i am facing", "we are facing",
]

MIN_WORDS = 5


# --------------------------------------------------------------------------
# Matching
# --------------------------------------------------------------------------

@lru_cache(maxsize=2048)
def _pattern(term: str) -> re.Pattern:
    """Whole-word matcher for one term, single word or phrase.

    \\b at each end is what stops "fan" matching inside "fantastic" and "fee"
    matching inside "feel" — the bug that plain substring search causes.
    """
    return re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)


def _found(text: str, terms: list[str]) -> list[str]:
    return [t for t in terms if _pattern(t).search(text)]


def _negated(text: str, term: str) -> bool:
    """True if `term` appears with a negation shortly before it.

    Catches "this is not urgent" and "no emergency here" without needing a
    parser — a short window before the match is enough in practice.
    """
    for match in _pattern(term).finditer(text):
        before = text[: match.start()].split()[-NEGATION_WINDOW:]
        if any(w.strip(",.;:").lower() in NEGATIONS for w in before):
            return True
    return False


def _active(text: str, terms: list[str]) -> list[str]:
    """Terms that are present and not negated."""
    return [t for t in _found(text, terms) if not _negated(text, t)]


# --------------------------------------------------------------------------
# Is this a complaint at all?
# --------------------------------------------------------------------------

def validate(text: str) -> dict:
    """Decide whether this is a real complaint.

    Returns {"is_complaint", "reason", "score"}. `reason` is shown directly to
    the student, so it says what to add rather than just refusing.

    This errs towards accepting on purpose. Wrongly rejecting a real grievance
    is a much worse failure than letting a junk one through, because a student
    who gets turned away may never report the problem again.
    """
    raw = (text or "").strip()
    words = re.findall(r"[a-zA-Z']+", raw)
    word_count = len(words)

    if word_count == 0:
        return _no("Nothing was recorded. Tap the microphone and describe the problem.")

    # Work out what the text contains before judging its length. A short
    # sentence that names a thing and says what is wrong with it — "wifi is
    # very slow" — is a perfectly good complaint and must not be refused.
    signals = _found(raw, GRIEVANCE_SIGNALS)
    category_hits = [
        kw for group in CATEGORY_KEYWORDS.values() for kw in _found(raw, group)
    ]
    is_specific = bool(signals) and bool(category_hits)

    if word_count < 3:
        return _no(
            f"That was only {word_count} word{'s' if word_count != 1 else ''}. "
            "Describe what is wrong and where, so the department can act on it."
        )

    if word_count < MIN_WORDS and not is_specific:
        return _no(
            f"That was only {word_count} words. Describe what is wrong and "
            "where, so the department can act on it."
        )

    for phrase in TEST_PHRASES:
        if _pattern(phrase).search(raw):
            return _no(
                "That looks like a test recording. When you are ready, describe "
                "the actual problem you are facing."
            )

    # Only reject as filler when the whole thing is filler. Stripping it out
    # of a longer sentence would throw away real words — "no" and "morning"
    # both carry meaning in "no water since morning".
    if all(w.lower() in FILLER for w in words):
        return _no(
            "That is a greeting rather than a complaint. Tell us what the "
            "problem is — what is wrong, and where."
        )

    # One word said over and over ("water water water water").
    counts = Counter(w.lower() for w in words)
    most_common, repeats = counts.most_common(1)[0]
    if word_count >= 6 and repeats / word_count > 0.6:
        return _no(
            f'That was mostly the word "{most_common}" repeated. '
            "Describe the problem in a full sentence."
        )

    # Gibberish — real English puts a vowel in nearly every word.
    vowelless = [w for w in words if len(w) > 2 and not re.search(r"[aeiou]", w.lower())]
    if word_count >= 5 and len(vowelless) / word_count > 0.5:
        return _no(
            "That did not come through clearly. Try again somewhere quieter, "
            "and speak a little slower."
        )

    if not signals and not category_hits:
        return _no(
            "We could not tell what the problem is. Say what is wrong, where it "
            "is happening, and since when."
        )

    return {
        "is_complaint": True,
        "reason": "",
        "score": len(signals) * 2 + len(category_hits) * 3,
    }


def _no(reason: str) -> dict:
    return {"is_complaint": False, "reason": reason, "score": 0}


# --------------------------------------------------------------------------
# Which department, and how urgent?
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Optional trained model
# --------------------------------------------------------------------------

_MODEL_PATH = Path(__file__).resolve().parent.parent / "ml" / "model" / "classifier.joblib"
_model = None
_model_checked = False


def _load_model():
    """Load the trained classifier once, if it is there.

    Everything here is best-effort on purpose. A missing model file, a
    missing scikit-learn, or a model saved by an incompatible version must
    all leave the system running on rules rather than failing to start.
    """
    global _model, _model_checked
    if _model_checked:
        return _model
    _model_checked = True

    if not _MODEL_PATH.exists():
        return None

    try:
        import joblib

        bundle = joblib.load(_MODEL_PATH)
        _model = bundle["pipeline"]
        print(f"[nlp] trained classifier loaded ({bundle.get('model_name', 'model')})")
    except Exception as exc:
        print(f"[nlp] could not load the trained model, using rules: {exc}")
        _model = None

    return _model


def model_is_active() -> bool:
    """True when the trained classifier is in use. Shown on /api/health."""
    return _load_model() is not None


def _model_category(text: str) -> tuple[str, float] | None:
    """Predict a category and a confidence, or None if unavailable.

    LinearSVC has no predict_proba, so confidence comes from the decision
    margin: how far ahead the winning class is from the runner-up. A wide
    margin means a clear decision.
    """
    model = _load_model()
    if model is None:
        return None

    try:
        predicted = model.predict([text])[0]

        if hasattr(model, "decision_function"):
            scores = sorted(model.decision_function([text])[0], reverse=True)
            margin = scores[0] - scores[1]
            confidence = round(min(max(margin / 1.5, 0.0), 1.0), 2)
        elif hasattr(model, "predict_proba"):
            confidence = round(float(max(model.predict_proba([text])[0])), 2)
        else:
            confidence = 0.5

        return predicted, confidence
    except Exception as exc:
        print(f"[nlp] prediction failed, using rules: {exc}")
        return None


def classify(
    transcript: str, fallback_category: str = "Academic", use_model: bool = True
) -> dict:
    """Work out which department should handle this, and how fast.

    `use_model=False` forces the keyword rules even when a trained model is
    loaded. That is what the training script uses to measure the rule
    baseline honestly — without it, the "baseline" would silently be the
    model and the comparison would be meaningless.

    Categories are scored by weight rather than count: a two-word phrase like
    "water supply" is far more telling than "water" alone, so longer matches
    count for more.
    """
    text = transcript or ""

    matches = {c: _found(text, terms) for c, terms in CATEGORY_KEYWORDS.items()}
    scores = {c: sum(len(m.split()) for m in hits) for c, hits in matches.items()}

    best = max(scores, key=scores.get)
    top_score = scores[best]

    # Nothing matched — trust what the student picked in the UI.
    category = best if top_score > 0 else fallback_category
    source = "rules"

    # The trained model takes over the category when it is available and
    # reasonably sure. Below that threshold the keyword rules are kept,
    # because a confident keyword match beats an uncertain prediction.
    prediction = _model_category(text) if use_model else None
    if prediction is not None:
        predicted_category, model_confidence = prediction
        if model_confidence >= 0.25 or top_score == 0:
            category = predicted_category
            source = "model"

    # Negation matters here: "this is not urgent" must not read as Urgent.
    if _active(text, URGENT_SIGNALS):
        priority = "Urgent"
    elif _active(text, HIGH_SIGNALS):
        priority = "High"
    elif _found(text, LOW_SIGNALS):
        priority = "Low"
    else:
        priority = "Normal"

    # Confidence reflects how clear the winner was, not just that it won.
    runner_up = sorted(scores.values(), reverse=True)[1] if len(scores) > 1 else 0
    if top_score == 0:
        confidence = 0.0
    else:
        margin = (top_score - runner_up) / top_score
        confidence = round(min(0.4 + margin * 0.6, 1.0), 2)

    if source == "model":
        confidence = model_confidence

    return {
        "category": category,
        "priority": priority,
        "keywords": matches.get(category, [])[:6],
        "confidence": confidence,
        "source": source,  # "model" or "rules" — useful when demonstrating
    }


def summarise(transcript: str, category: str) -> str:
    """A short title for lists and tables.

    Strips the run-up people say before getting to the point, so the title is
    the problem itself rather than "I would like to complain about the...".
    """
    clean = re.sub(r"\s+", " ", transcript or "").strip()
    if not clean:
        return f"{category} complaint"

    lowered = clean.lower()
    for prefix in sorted(TITLE_PREFIXES, key=len, reverse=True):
        if lowered.startswith(prefix):
            clean = clean[len(prefix):].strip(" ,.")
            break

    if not clean:
        return f"{category} complaint"

    first = re.split(r"(?<=[.!?])\s", clean)[0]
    title = " ".join(first.split(" ")[:10]).rstrip(".,;: ")
    return (title[:1].upper() + title[1:])[:200]

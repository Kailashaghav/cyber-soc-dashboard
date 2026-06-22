import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler

sys.path.append(str(Path(__file__).parent))
from schema import NSL_KDD_COLUMNS, CATEGORICAL_COLUMNS, ATTACK_CATEGORY_MAP
from safe_label_encoder import SafeLabelEncoder

ROOT = Path(__file__).resolve().parents[3]  # cyber-soc-dashboard/
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "data" / "models"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def load_raw(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, header=None, names=NSL_KDD_COLUMNS)
    return df


def add_targets(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["binary_label"] = (df["label"] != "normal").astype(int)
    df["category_label"] = df["label"].map(
        lambda x: "normal" if x == "normal" else ATTACK_CATEGORY_MAP.get(x, "other")
    )
    return df


def main():
    print("Loading raw NSL-KDD data...")
    train_df = load_raw(RAW_DIR / "KDDTrain.txt")
    test_df = load_raw(RAW_DIR / "KDDTest.txt")
    print(f"  train: {train_df.shape}, test: {test_df.shape}")

    train_df = add_targets(train_df)
    test_df = add_targets(test_df)

    print("\nBinary label distribution (train):")
    print(train_df["binary_label"].value_counts())
    print("\nCategory label distribution (train):")
    print(train_df["category_label"].value_counts())

    # Encode categoricals -- fit on train only
    encoders = {}
    for col in CATEGORICAL_COLUMNS:
        enc = SafeLabelEncoder()
        enc.fit(train_df[col])
        train_df[col + "_enc"] = enc.transform(train_df[col])
        test_df[col + "_enc"] = enc.transform(test_df[col])
        encoders[col] = enc
        print(f"  encoded '{col}': {len(enc.classes_)} classes")

    feature_cols = [c for c in NSL_KDD_COLUMNS if c not in ("label",) + tuple(CATEGORICAL_COLUMNS)]
    feature_cols = [c for c in feature_cols if c != "difficulty"]
    feature_cols += [c + "_enc" for c in CATEGORICAL_COLUMNS]

    X_train = train_df[feature_cols].astype(float).values
    X_test = test_df[feature_cols].astype(float).values

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    y_train_binary = train_df["binary_label"].values
    y_test_binary = test_df["binary_label"].values

    cat_encoder = LabelEncoder()
    y_train_cat = cat_encoder.fit_transform(train_df["category_label"])
    # category_label test set might contain categories absent in train (rare); guard it
    known_cats = set(cat_encoder.classes_)
    test_cats_safe = test_df["category_label"].map(lambda c: c if c in known_cats else "other")
    if "other" not in known_cats:
        # extend encoder classes_ to include 'other' fallback bucket
        cat_encoder.classes_ = np.append(cat_encoder.classes_, "other")
    y_test_cat = cat_encoder.transform(test_cats_safe)

    np.save(PROCESSED_DIR / "X_train.npy", X_train_scaled)
    np.save(PROCESSED_DIR / "X_test.npy", X_test_scaled)
    np.save(PROCESSED_DIR / "y_train_binary.npy", y_train_binary)
    np.save(PROCESSED_DIR / "y_test_binary.npy", y_test_binary)
    np.save(PROCESSED_DIR / "y_train_cat.npy", y_train_cat)
    np.save(PROCESSED_DIR / "y_test_cat.npy", y_test_cat)

    joblib.dump(scaler, MODELS_DIR / "scaler.joblib")
    joblib.dump(encoders, MODELS_DIR / "categorical_encoders.joblib")
    joblib.dump(cat_encoder, MODELS_DIR / "category_label_encoder.joblib")
    joblib.dump(feature_cols, MODELS_DIR / "feature_columns.joblib")

    print(f"\nSaved processed arrays to {PROCESSED_DIR}")
    print(f"Saved transformers to {MODELS_DIR}")
    print(f"Feature count: {len(feature_cols)}")
    print("Done.")


if __name__ == "__main__":
    main()

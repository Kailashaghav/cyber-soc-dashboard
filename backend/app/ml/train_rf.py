import sys
import time
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

sys.path.append(str(Path(__file__).parent))

ROOT = Path(__file__).resolve().parents[3]
PROCESSED_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "data" / "models"


def load_data():
    X_train = np.load(PROCESSED_DIR / "X_train.npy")
    X_test = np.load(PROCESSED_DIR / "X_test.npy")
    y_train_binary = np.load(PROCESSED_DIR / "y_train_binary.npy")
    y_test_binary = np.load(PROCESSED_DIR / "y_test_binary.npy")
    y_train_cat = np.load(PROCESSED_DIR / "y_train_cat.npy")
    y_test_cat = np.load(PROCESSED_DIR / "y_test_cat.npy")
    return X_train, X_test, y_train_binary, y_test_binary, y_train_cat, y_test_cat


def train_binary(X_train, X_test, y_train, y_test):
    print("\n=== Training RandomForest: BINARY (normal vs attack) ===")
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=42,
        class_weight="balanced",
    )
    t0 = time.time()
    clf.fit(X_train, y_train)
    print(f"  trained in {time.time() - t0:.1f}s")

    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]

    print("\nClassification report (test set):")
    print(classification_report(y_test, y_pred, target_names=["normal", "attack"]))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))
    print(f"ROC-AUC: {roc_auc_score(y_test, y_proba):.4f}")

    joblib.dump(clf, MODELS_DIR / "rf_binary.joblib")
    return clf


def train_category(X_train, X_test, y_train, y_test):
    print("\n=== Training RandomForest: MULTI-CLASS (attack category) ===")
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=42,
        class_weight="balanced",
    )
    t0 = time.time()
    clf.fit(X_train, y_train)
    print(f"  trained in {time.time() - t0:.1f}s")

    y_pred = clf.predict(X_test)
    cat_encoder = joblib.load(MODELS_DIR / "category_label_encoder.joblib")
    labels_present = sorted(set(y_test) | set(y_pred))
    target_names = [cat_encoder.classes_[i] for i in labels_present]

    print("\nClassification report (test set):")
    print(classification_report(y_test, y_pred, labels=labels_present, target_names=target_names))

    joblib.dump(clf, MODELS_DIR / "rf_category.joblib")
    return clf


def print_top_features(clf, feature_cols, top_n=10):
    importances = clf.feature_importances_
    idx = np.argsort(importances)[::-1][:top_n]
    print(f"\nTop {top_n} most important features:")
    for i in idx:
        print(f"  {feature_cols[i]:<30s} {importances[i]:.4f}")


def main():
    X_train, X_test, y_train_binary, y_test_binary, y_train_cat, y_test_cat = load_data()
    print(f"Loaded: X_train {X_train.shape}, X_test {X_test.shape}")

    rf_binary = train_binary(X_train, X_test, y_train_binary, y_test_binary)
    rf_category = train_category(X_train, X_test, y_train_cat, y_test_cat)

    feature_cols = joblib.load(MODELS_DIR / "feature_columns.joblib")
    print_top_features(rf_binary, feature_cols)

    print(f"\nModels saved to {MODELS_DIR}")
    print("Done.")


if __name__ == "__main__":
    main()

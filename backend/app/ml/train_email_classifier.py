import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

ROOT = Path(__file__).resolve().parents[3]
PROCESSED_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "data" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def main():
    train_df = pd.read_csv(PROCESSED_DIR / "email_train.csv")
    test_df = pd.read_csv(PROCESSED_DIR / "email_test.csv")
    train_df["text"] = train_df["text"].fillna("")
    test_df["text"] = test_df["text"].fillna("")
    print(f"Train: {train_df.shape}, Test: {test_df.shape}")

    print("\nFitting TF-IDF vectorizer...")
    vectorizer = TfidfVectorizer(
        max_features=20000,
        ngram_range=(1, 2),     # unigrams + bigrams -- catches phrases like "verify account"
        min_df=2,
        stop_words="english",
        sublinear_tf=True,
    )
    t0 = time.time()
    X_train = vectorizer.fit_transform(train_df["text"])
    X_test = vectorizer.transform(test_df["text"])
    print(f"  vectorized in {time.time() - t0:.1f}s, vocab size={len(vectorizer.vocabulary_)}")

    y_train = train_df["label"].values
    y_test = test_df["label"].values

    print("\nTraining Logistic Regression...")
    clf = LogisticRegression(max_iter=1000, C=1.0, class_weight="balanced", random_state=42)
    t0 = time.time()
    clf.fit(X_train, y_train)
    print(f"  trained in {time.time() - t0:.1f}s")

    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]

    print("\n=== Test set evaluation ===")
    print(classification_report(y_test, y_pred, target_names=["ham", "spam/phishing"]))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))
    print(f"ROC-AUC: {roc_auc_score(y_test, y_proba):.4f}")

    # Show most predictive words for "phishing" class -- great demo material
    feature_names = np.array(vectorizer.get_feature_names_out())
    coefs = clf.coef_[0]
    top_spam_idx = np.argsort(coefs)[::-1][:15]
    top_ham_idx = np.argsort(coefs)[:15]
    print("\nTop words/phrases pushing toward SPAM/PHISHING:")
    for i in top_spam_idx:
        print(f"  {feature_names[i]:<25s} {coefs[i]:.3f}")
    print("\nTop words/phrases pushing toward HAM (legitimate):")
    for i in top_ham_idx:
        print(f"  {feature_names[i]:<25s} {coefs[i]:.3f}")

    joblib.dump(vectorizer, MODELS_DIR / "email_tfidf_vectorizer.joblib")
    joblib.dump(clf, MODELS_DIR / "email_classifier.joblib")
    print(f"\nSaved vectorizer + classifier to {MODELS_DIR}")
    print("Done.")


if __name__ == "__main__":
    main()

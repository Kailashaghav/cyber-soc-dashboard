import sys
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[3]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def main():
    print("Loading Enron spam dataset...")
    df = pd.read_csv(RAW_DIR / "enron_spam_data.csv")
    print(f"  raw shape: {df.shape}")

    df["Subject"] = df["Subject"].fillna("")
    df["Message"] = df["Message"].fillna("")
    df["text"] = (df["Subject"] + " " + df["Message"]).str.strip()

    # Drop rows where combined text is empty -- no signal to learn from
    df = df[df["text"].str.len() > 0].reset_index(drop=True)
    print(f"  after dropping empty text: {df.shape}")

    df["label"] = (df["Spam/Ham"].str.lower() == "spam").astype(int)
    print("\nLabel distribution:")
    print(df["label"].value_counts())

    train_df, test_df = train_test_split(
        df[["text", "label"]],
        test_size=0.2,
        random_state=42,
        stratify=df["label"],
    )

    train_df.to_csv(PROCESSED_DIR / "email_train.csv", index=False)
    test_df.to_csv(PROCESSED_DIR / "email_test.csv", index=False)

    print(f"\nTrain: {train_df.shape}, Test: {test_df.shape}")
    print(f"Saved to {PROCESSED_DIR}")
    print("Done.")


if __name__ == "__main__":
    main()

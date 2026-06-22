import sys
import time
from pathlib import Path

import joblib
import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

sys.path.append(str(Path(__file__).parent))

ROOT = Path(__file__).resolve().parents[3]
PROCESSED_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "data" / "models"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class Autoencoder(nn.Module):
    """Simple symmetric autoencoder: 41 -> 32 -> 16 -> 8 -> 16 -> 32 -> 41."""

    def __init__(self, input_dim: int):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 32), nn.ReLU(),
            nn.Linear(32, 16), nn.ReLU(),
            nn.Linear(16, 8), nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(8, 16), nn.ReLU(),
            nn.Linear(16, 32), nn.ReLU(),
            nn.Linear(32, input_dim),
        )

    def forward(self, x):
        z = self.encoder(x)
        out = self.decoder(z)
        return out


def load_data():
    X_train = np.load(PROCESSED_DIR / "X_train.npy")
    X_test = np.load(PROCESSED_DIR / "X_test.npy")
    y_train_binary = np.load(PROCESSED_DIR / "y_train_binary.npy")
    y_test_binary = np.load(PROCESSED_DIR / "y_test_binary.npy")
    return X_train, X_test, y_train_binary, y_test_binary


def train_autoencoder(X_normal_train: np.ndarray, input_dim: int, epochs: int = 30, batch_size: int = 256):
    model = Autoencoder(input_dim).to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.MSELoss()

    X_tensor = torch.tensor(X_normal_train, dtype=torch.float32).to(DEVICE)
    n_samples = X_tensor.shape[0]

    print(f"Training autoencoder on {n_samples} NORMAL-ONLY samples for {epochs} epochs...")
    model.train()
    t0 = time.time()
    for epoch in range(epochs):
        perm = torch.randperm(n_samples)
        epoch_loss = 0.0
        n_batches = 0
        for i in range(0, n_samples, batch_size):
            idx = perm[i:i + batch_size]
            batch = X_tensor[idx]
            optimizer.zero_grad()
            recon = model(batch)
            loss = loss_fn(recon, batch)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"  epoch {epoch + 1}/{epochs}  avg_loss={epoch_loss / n_batches:.6f}")
    print(f"  trained in {time.time() - t0:.1f}s")
    return model


def compute_reconstruction_error(model, X: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        X_tensor = torch.tensor(X, dtype=torch.float32).to(DEVICE)
        recon = model(X_tensor)
        errors = torch.mean((recon - X_tensor) ** 2, dim=1)
    return errors.cpu().numpy()


def main():
    X_train, X_test, y_train_binary, y_test_binary = load_data()
    input_dim = X_train.shape[1]
    print(f"Loaded: X_train {X_train.shape}, X_test {X_test.shape}, input_dim={input_dim}")
    print(f"Using device: {DEVICE}")

    # Train ONLY on normal traffic (binary_label == 0)
    X_normal_train = X_train[y_train_binary == 0]
    model = train_autoencoder(X_normal_train, input_dim, epochs=30)

    # Determine threshold from normal training reconstruction error distribution
    train_errors_normal = compute_reconstruction_error(model, X_normal_train)
    threshold = float(np.percentile(train_errors_normal, 95))
    print(f"\nReconstruction error threshold (95th pct of normal train): {threshold:.6f}")

    # Evaluate on test set (mix of normal + attack, including UNSEEN attack types)
    test_errors = compute_reconstruction_error(model, X_test)
    y_pred = (test_errors > threshold).astype(int)

    print("\n=== Autoencoder anomaly detection on test set ===")
    print("Classification report:")
    print(classification_report(y_test_binary, y_pred, target_names=["normal", "attack"]))
    print("Confusion matrix:")
    print(confusion_matrix(y_test_binary, y_pred))
    print(f"ROC-AUC (using raw reconstruction error as score): {roc_auc_score(y_test_binary, test_errors):.4f}")

    # Save model + threshold + input_dim for inference
    torch.save(model.state_dict(), MODELS_DIR / "autoencoder.pt")
    joblib.dump({"threshold": threshold, "input_dim": input_dim}, MODELS_DIR / "autoencoder_meta.joblib")
    print(f"\nSaved autoencoder + metadata to {MODELS_DIR}")
    print("Done.")


if __name__ == "__main__":
    main()

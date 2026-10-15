"""
NeuroSense AI — Advanced Grouped Validation, Late Fusion, and Clinical Calibration
"""

import os
import sys
import time
import numpy as np
import pandas as pd
from scipy import stats

from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.cluster import AgglomerativeClustering
from sklearn.model_selection import StratifiedGroupKFold, RepeatedStratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier
from sklearn.metrics import (
    roc_auc_score, accuracy_score, recall_score, f1_score,
    brier_score_loss, roc_curve
)
from sklearn.calibration import calibration_curve, CalibratedClassifierCV


def load_all_data():
    df_comb = pd.read_csv("models/features_combined.csv")
    df_v3 = pd.read_csv("models/features_v3.csv")
    df_v4 = pd.read_csv("models/features_v4.csv")

    for df in [df_comb, df_v3, df_v4]:
        mel_cols = [c for c in df.columns if c.startswith("mel_")]
        if mel_cols:
            df[mel_cols] = np.log1p(np.clip(df[mel_cols].values, 0, None))

    y = df_v4["label"].astype(int).values

    feature_sets = {
        "v4_all": df_v4.drop(columns=["label"]),
        "v4_bert_only": df_v4[[c for c in df_v4.columns if c.startswith("bert_")]],
        "c_v3_with_iu": df_v3.drop(columns=["label"]),
        "b_v3_no_iu": df_v3.drop(columns=["label"] + [c for c in df_v3.columns if c.startswith("iu_")]),
        "a_combined": df_comb.drop(columns=["label"])
    }
    return df_comb, df_v3, df_v4, feature_sets, y


def build_pipeline(model_name, n_features):
    if model_name == "LogisticRegression":
        k = min(60, n_features)
        return Pipeline([
            ("scaler", StandardScaler()),
            ("select", SelectKBest(score_func=f_classif, k=k)),
            ("clf", LogisticRegression(C=0.1, penalty="l2", solver="liblinear", class_weight="balanced", random_state=42))
        ])
    elif model_name == "SVM_RBF":
        k = min(80, n_features)
        return Pipeline([
            ("scaler", RobustScaler()),
            ("select", SelectKBest(score_func=f_classif, k=k)),
            ("clf", SVC(C=1.0, kernel="rbf", probability=True, class_weight="balanced", random_state=42))
        ])
    elif model_name == "RandomForest":
        return RandomForestClassifier(n_estimators=400, min_samples_leaf=2, class_weight="balanced", random_state=42, n_jobs=-1)
    elif model_name == "ExtraTrees":
        return ExtraTreesClassifier(n_estimators=400, min_samples_leaf=2, class_weight="balanced", random_state=42, n_jobs=-1)
    else:
        raise ValueError(f"Unknown model: {model_name}")


# --------------------------------------------------------------------------
# PART 1: Proxy speaker groups
# --------------------------------------------------------------------------
def compute_proxy_speaker_groups(df_comb, y):
    mfcc_cols = [f"mfcc_mean_{i}" for i in range(1, 14)] + [f"mfcc_std_{i}" for i in range(1, 14)]
    X_mfcc = StandardScaler().fit_transform(df_comb[mfcc_cols].values)

    thresholds = [0.95, 0.90, 0.85]
    clustering_results = {}

    print("="*60)
    print("PART 1: PROXY SPEAKER GROUPS (Agglomerative Clustering)")
    print("="*60)

    for sim_thresh in thresholds:
        dist_thresh = 1.0 - sim_thresh
        clusterer = AgglomerativeClustering(
            metric="cosine", linkage="average", distance_threshold=dist_thresh, n_clusters=None
        )
        labels = clusterer.fit_predict(X_mfcc)
        clustering_results[sim_thresh] = labels

        sizes = pd.Series(labels).value_counts()
        n_groups = len(sizes)
        min_sz = sizes.min()
        med_sz = sizes.median()
        max_sz = sizes.max()
        singletons = (sizes == 1).sum()

        mixed_count = 0
        for grp in set(labels):
            grp_y = y[labels == grp]
            if len(set(grp_y)) > 1:
                mixed_count += 1

        print(f"Similarity Threshold >= {sim_thresh:.2f} (Cosine dist <= {dist_thresh:.2f}):")
        print(f"  Total proxy groups : {n_groups}")
        print(f"  Group sizes        : min={min_sz}, median={med_sz:.1f}, max={max_sz}")
        print(f"  Singletons         : {singletons} ({singletons / len(df_comb) * 100:.1f}% of recordings)")
        print(f"  Mixed-label groups : {mixed_count} groups contain both Dementia and Control rows\n")

    return clustering_results


# --------------------------------------------------------------------------
# PART 2: Grouped validation vs Random Split
# --------------------------------------------------------------------------
def run_grouped_validation(feature_sets, y, clustering_results):
    models = ["SVM_RBF", "RandomForest", "ExtraTrees", "LogisticRegression"]
    fsets = ["v4_all", "v4_bert_only", "c_v3_with_iu", "b_v3_no_iu", "a_combined"]
    seeds = [42, 43, 44]

    # Conditions: random split, grouped@0.95, grouped@0.90, grouped@0.85
    conditions = ["random", 0.95, 0.90, 0.85]
    all_metrics = {}

    print("="*60)
    print("PART 2: GROUPED VALIDATION BENCHMARK (3 repeats x 5 folds = 15 splits)")
    print("="*60)

    for cond in conditions:
        cond_name = f"grouped@{cond}" if isinstance(cond, float) else "random"
        print(f"\nRunning Condition: {cond_name}...")
        t0 = time.time()

        for fs_key in fsets:
            X = feature_sets[fs_key]
            n_feat = X.shape[1]

            for m_name in models:
                key = (cond_name, fs_key, m_name)
                aucs, sens, specs, accs = [], [], [], []

                for seed in seeds:
                    if cond == "random":
                        splitter = RepeatedStratifiedKFold(n_splits=5, n_repeats=1, random_state=seed)
                        splits = splitter.split(X, y)
                    else:
                        groups = clustering_results[cond]
                        sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
                        splits = sgkf.split(X, y, groups)

                    for tr, te in splits:
                        X_tr, X_te = X.iloc[tr], X.iloc[te]
                        y_tr, y_te = y[tr], y[te]

                        pipe = build_pipeline(m_name, n_feat)
                        pipe.fit(X_tr, y_tr)
                        y_prob = pipe.predict_proba(X_te)[:, 1]
                        y_pred = (y_prob >= 0.5).astype(int)

                        aucs.append(roc_auc_score(y_te, y_prob))
                        sens.append(recall_score(y_te, y_pred, pos_label=1))
                        specs.append(recall_score(y_te, y_pred, pos_label=0))
                        accs.append(accuracy_score(y_te, y_pred))

                all_metrics[key] = {
                    "auc_mean": np.mean(aucs),
                    "auc_std": np.std(aucs),
                    "sens_mean": np.mean(sens),
                    "sens_std": np.std(sens),
                    "spec_mean": np.mean(specs),
                    "spec_std": np.std(specs),
                    "acc_mean": np.mean(accs),
                    "acc_std": np.std(accs),
                    "raw_aucs": aucs
                }

        print(f"Condition {cond_name} completed in {time.time() - t0:.1f}s")

    return all_metrics


# --------------------------------------------------------------------------
# PART 3: Late Fusion (with Grouped CV @ 0.90)
# --------------------------------------------------------------------------
def run_late_fusion(df_v4, y, groups_90):
    print("\n" + "="*60)
    print("PART 3: LATE FUSION (Grouped CV @ threshold 0.90)")
    print("="*60)

    # Define modalities
    acoustic_cols = (
        [c for c in df_v4.columns if c.startswith("mfcc_")] +
        [c for c in df_v4.columns if c.startswith("chroma_")] +
        [c for c in df_v4.columns if c.startswith("mel_")] +
        ["zcr", "rms", "spectral_centroid", "spectral_rolloff",
         "speech_ratio", "avg_utterance_ms", "avg_pause_ms", "max_pause_ms", "num_utterances"]
    )
    lexical_iu_cols = (
        [c for c in df_v4.columns if c.startswith("iu_")] +
        ["total_words", "unique_words", "ttr", "brunets", "honores",
         "pronoun_count", "pronoun_ratio", "filler_count", "filler_rate",
         "revision_count", "revision_rate", "repetition_count", "repetition_rate",
         "incomplete_count", "mean_utt_len", "std_utt_len", "max_utt_len", "min_utt_len",
         "num_utts", "discourse_marker_count", "discourse_marker_rate", "starter_variety",
         "repeat_ratio", "semantic_density", "completion_rate"]
    )
    bert_cols = [c for c in df_v4.columns if c.startswith("bert_")]

    X_A = df_v4[acoustic_cols]
    X_B = df_v4[lexical_iu_cols]
    X_C = df_v4[bert_cols]
    X_all = df_v4.drop(columns=["label"])

    print(f"Modality (A) Acoustic + Temporal : {X_A.shape[1]} features")
    print(f"Modality (B) Lexical + IU        : {X_B.shape[1]} features")
    print(f"Modality (C) BERT Embeddings     : {X_C.shape[1]} features")
    print(f"Full Multimodal (v4_all)         : {X_all.shape[1]} features")

    # Grouped 5-fold CV with 3 repeats (seeds 42, 43, 44)
    seeds = [42, 43, 44]

    fold_aucs_svm_all = []
    fold_aucs_A = []
    fold_aucs_B = []
    fold_aucs_C = []
    fold_aucs_avg = []
    fold_aucs_stack = []

    # Out-of-fold probability containers for repeat 0 (seed 42) for calibration curve & Brier score
    oof_probs_stack = np.zeros(len(df_v4))
    oof_probs_avg = np.zeros(len(df_v4))
    oof_probs_svm_all = np.zeros(len(df_v4))

    for repeat_idx, seed in enumerate(seeds):
        sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)

        for tr, te in sgkf.split(X_all, y, groups_90):
            y_tr, y_te = y[tr], y[te]
            grps_tr = groups_90[tr]

            # Model configurations
            pipe_svm_all = build_pipeline("SVM_RBF", X_all.shape[1])
            pipe_A = build_pipeline("SVM_RBF", X_A.shape[1])
            pipe_B = build_pipeline("LogisticRegression", X_B.shape[1])
            pipe_C = build_pipeline("SVM_RBF", X_C.shape[1])

            # 1. Benchmark Single SVM on v4_all
            pipe_svm_all.fit(X_all.iloc[tr], y_tr)
            p_svm_all = pipe_svm_all.predict_proba(X_all.iloc[te])[:, 1]
            fold_aucs_svm_all.append(roc_auc_score(y_te, p_svm_all))

            # 2. Modality models test predictions
            pipe_A.fit(X_A.iloc[tr], y_tr)
            pipe_B.fit(X_B.iloc[tr], y_tr)
            pipe_C.fit(X_C.iloc[tr], y_tr)

            p_A_te = pipe_A.predict_proba(X_A.iloc[te])[:, 1]
            p_B_te = pipe_B.predict_proba(X_B.iloc[te])[:, 1]
            p_C_te = pipe_C.predict_proba(X_C.iloc[te])[:, 1]

            fold_aucs_A.append(roc_auc_score(y_te, p_A_te))
            fold_aucs_B.append(roc_auc_score(y_te, p_B_te))
            fold_aucs_C.append(roc_auc_score(y_te, p_C_te))

            # (i) Simple Averaging
            p_avg_te = (p_A_te + p_B_te + p_C_te) / 3.0
            fold_aucs_avg.append(roc_auc_score(y_te, p_avg_te))

            # (ii) Stacking with Logistic Regression (Nested Grouped CV on training fold)
            inner_sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
            inner_oof_A = np.zeros(len(tr))
            inner_oof_B = np.zeros(len(tr))
            inner_oof_C = np.zeros(len(tr))

            for in_tr, in_te in inner_sgkf.split(X_A.iloc[tr], y_tr, grps_tr):
                in_pipe_A = build_pipeline("SVM_RBF", X_A.shape[1])
                in_pipe_B = build_pipeline("LogisticRegression", X_B.shape[1])
                in_pipe_C = build_pipeline("SVM_RBF", X_C.shape[1])

                in_pipe_A.fit(X_A.iloc[tr].iloc[in_tr], y_tr[in_tr])
                in_pipe_B.fit(X_B.iloc[tr].iloc[in_tr], y_tr[in_tr])
                in_pipe_C.fit(X_C.iloc[tr].iloc[in_tr], y_tr[in_tr])

                inner_oof_A[in_te] = in_pipe_A.predict_proba(X_A.iloc[tr].iloc[in_te])[:, 1]
                inner_oof_B[in_te] = in_pipe_B.predict_proba(X_B.iloc[tr].iloc[in_te])[:, 1]
                inner_oof_C[in_te] = in_pipe_C.predict_proba(X_C.iloc[tr].iloc[in_te])[:, 1]

            meta_X_tr = np.column_stack([inner_oof_A, inner_oof_B, inner_oof_C])
            meta_X_te = np.column_stack([p_A_te, p_B_te, p_C_te])

            meta_learner = LogisticRegression(C=1.0, penalty="l2", solver="lbfgs", random_state=42)
            meta_learner.fit(meta_X_tr, y_tr)
            p_stack_te = meta_learner.predict_proba(meta_X_te)[:, 1]

            fold_aucs_stack.append(roc_auc_score(y_te, p_stack_te))

            if repeat_idx == 0:
                oof_probs_stack[te] = p_stack_te
                oof_probs_avg[te] = p_avg_te
                oof_probs_svm_all[te] = p_svm_all

    fusion_summary = {
        "Modality A (Acoustic)": (np.mean(fold_aucs_A), np.std(fold_aucs_A), fold_aucs_A),
        "Modality B (Lexical+IU)": (np.mean(fold_aucs_B), np.std(fold_aucs_B), fold_aucs_B),
        "Modality C (BERT)": (np.mean(fold_aucs_C), np.std(fold_aucs_C), fold_aucs_C),
        "Late Fusion (Simple Averaging)": (np.mean(fold_aucs_avg), np.std(fold_aucs_avg), fold_aucs_avg),
        "Late Fusion (Stacking LogReg)": (np.mean(fold_aucs_stack), np.std(fold_aucs_stack), fold_aucs_stack),
        "Single SVM RBF (v4_all Early Fusion)": (np.mean(fold_aucs_svm_all), np.std(fold_aucs_svm_all), fold_aucs_svm_all)
    }

    print("\n--- Late Fusion Comparison (Grouped CV @ 0.90) ---")
    for name, (m, s, _) in fusion_summary.items():
        print(f"  {name:<38s} -> ROC-AUC: {m:.4f} ± {s:.4f}")

    # Paired test: Stacking vs Single SVM RBF (v4_all)
    t_stat, p_val = stats.ttest_rel(fold_aucs_stack, fold_aucs_svm_all)
    w_stat, w_pval = stats.wilcoxon(np.array(fold_aucs_stack) - np.array(fold_aucs_svm_all))
    print(f"\nPaired Test across 15 folds (Stacking vs Single SVM v4_all):")
    print(f"  Paired t-test : t = {t_stat:+.3f}, p-value = {p_val:.4f}")
    print(f"  Wilcoxon test : W = {w_stat:.1f}, p-value = {w_pval:.4f}")

    # Paired test: Stacking vs Simple Average
    t_avg, p_avg = stats.ttest_rel(fold_aucs_stack, fold_aucs_avg)
    print(f"Paired Test (Stacking vs Simple Average): t = {t_avg:+.3f}, p = {p_avg:.4f}")

    return fusion_summary, oof_probs_stack, oof_probs_avg, oof_probs_svm_all


# --------------------------------------------------------------------------
# PART 4: Calibration and Thresholds
# --------------------------------------------------------------------------
def evaluate_calibration_and_prevalence(y, oof_probs_best, oof_probs_uncalibrated):
    print("\n" + "="*60)
    print("PART 4: CALIBRATION & CLINICAL THRESHOLDS")
    print("="*60)

    # 1. Brier score
    brier_uncal = brier_score_loss(y, oof_probs_uncalibrated)
    print(f"Uncalibrated Out-Of-Fold Brier Score: {brier_uncal:.4f}")

    # Calibration curve (5 bins quantile/uniform)
    prob_true, prob_pred = calibration_curve(y, oof_probs_uncalibrated, n_bins=5, strategy="uniform")
    print("\nCalibration Curve (Uniform 5 Bins):")
    for b_idx in range(len(prob_true)):
        print(f"  Bin {b_idx+1}: Mean Predicted = {prob_pred[b_idx]:.3f}, Observed Fraction Positive = {prob_true[b_idx]:.3f}")

    # Platt / Sigmoid calibration on OOF predictions
    platt = LogisticRegression(C=1.0, solver="lbfgs")
    platt.fit(oof_probs_uncalibrated.reshape(-1, 1), y)
    probs_platt = platt.predict_proba(oof_probs_uncalibrated.reshape(-1, 1))[:, 1]
    brier_platt = brier_score_loss(y, probs_platt)
    print(f"Platt Calibrated Brier Score: {brier_platt:.4f} (Delta: {brier_platt - brier_uncal:+.4f})")

    # 2. Operating Threshold for 90% Sensitivity
    # Compute ROC curve to find threshold
    fpr, tpr, thresholds = roc_curve(y, oof_probs_uncalibrated)
    # Find points with TPR >= 0.90
    idx_90 = np.where(tpr >= 0.90)[0]
    best_idx = idx_90[0]
    thresh_90 = thresholds[best_idx]
    achieved_sens = tpr[best_idx]
    achieved_spec = 1.0 - fpr[best_idx]

    print(f"\nOperating Threshold for 90% Sensitivity:")
    print(f"  Decision Cutoff Threshold : {thresh_90:.4f}")
    print(f"  Achieved Sensitivity      : {achieved_sens*100:.2f}% ({achieved_sens:.4f})")
    print(f"  Corresponding Specificity : {achieved_spec*100:.2f}% ({achieved_spec:.4f})")

    # 3. PPV and NPV at 5%, 10%, and 56% (Dataset) Prevalence
    prevalences = [0.05, 0.10, 0.562]
    prev_labels = ["5% (General Community Population)", "10% (Primary Care Memory Complaint Clinic)", "56.2% (Enriched Dataset Prevalence)"]

    print("\nClinical Predictive Values (at 90% Sensitivity Operating Point):")
    clinical_table = []
    for prev, label in zip(prevalences, prev_labels):
        tp = achieved_sens * prev
        fn = (1.0 - achieved_sens) * prev
        tn = achieved_spec * (1.0 - prev)
        fp = (1.0 - achieved_spec) * (1.0 - prev)

        ppv = tp / (tp + fp)
        npv = tn / (tn + fn)

        clinical_table.append({
            "Prevalence Setting": label,
            "Prevalence": f"{prev*100:.1f}%",
            "Sensitivity": f"{achieved_sens*100:.1f}%",
            "Specificity": f"{achieved_spec*100:.1f}%",
            "PPV": f"{ppv*100:.2f}%",
            "NPV": f"{npv*100:.2f}%"
        })
        print(f"  {label}:")
        print(f"    PPV (Precision) = {ppv*100:.2f}%")
        print(f"    NPV             = {npv*100:.2f}%")

    return clinical_table, thresh_90, achieved_sens, achieved_spec, brier_uncal, brier_platt


def main():
    df_comb, df_v3, df_v4, feature_sets, y = load_all_data()

    # Part 1
    clustering_results = compute_proxy_speaker_groups(df_comb, y)

    # Part 2
    all_metrics = run_grouped_validation(feature_sets, y, clustering_results)

    # Part 3
    groups_90 = clustering_results[0.90]
    fusion_summary, oof_stack, oof_avg, oof_svm = run_late_fusion(df_v4, y, groups_90)

    # Part 4
    # Best fused model is Stacking LogReg or Single SVM
    best_oof = oof_stack if fusion_summary["Late Fusion (Stacking LogReg)"][0] >= fusion_summary["Single SVM RBF (v4_all Early Fusion)"][0] else oof_svm
    clinical_table, thresh_90, sens_90, spec_90, brier_raw, brier_cal = evaluate_calibration_and_prevalence(
        y, best_oof, best_oof
    )

    # Save summary dataframe of Part 2 to CSV
    records = []
    for (cond, fs, model), vals in all_metrics.items():
        records.append({
            "condition": cond,
            "feature_set": fs,
            "model": model,
            "auc_mean": vals["auc_mean"],
            "auc_std": vals["auc_std"],
            "sens_mean": vals["sens_mean"],
            "sens_std": vals["sens_std"],
            "spec_mean": vals["spec_mean"],
            "spec_std": vals["spec_std"],
            "acc_mean": vals["acc_mean"],
            "acc_std": vals["acc_std"]
        })
    df_grouped = pd.DataFrame(records)
    df_grouped.to_csv("grouped_cv_results.csv", index=False)
    print("\n[Done] All experiments finished. Results saved to grouped_cv_results.csv.")


if __name__ == "__main__":
    main()

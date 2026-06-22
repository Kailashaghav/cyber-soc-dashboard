from sklearn.preprocessing import LabelEncoder


class SafeLabelEncoder:
    """
    LabelEncoder that maps any category unseen at fit-time to a single
    reserved 'UNK' bucket at transform-time, instead of crashing.
    """

    def __init__(self):
        self.le = LabelEncoder()
        self.classes_ = None

    def fit(self, values):
        values = list(values) + ["UNK"]
        self.le.fit(values)
        self.classes_ = self.le.classes_
        return self

    def transform(self, values):
        known = set(self.classes_)
        safe_values = [v if v in known else "UNK" for v in values]
        return self.le.transform(safe_values)

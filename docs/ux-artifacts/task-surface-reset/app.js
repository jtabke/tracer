const pages = document.querySelectorAll("[data-page]");
const breadcrumbRecord = document.querySelector("[data-breadcrumb-record]");
const openReceipt = document.querySelector("[data-open-receipt]");
const returnToRequirements = document.querySelector("[data-return]");
const receiptHeading = document.querySelector("[data-receipt-heading]");
const reviewForm = document.querySelector("[data-review-form]");
const reviewStates = document.querySelectorAll("[data-review-state]");
const reviewFeedback = document.querySelector(".form-feedback");

function showPage(name) {
  pages.forEach((page) => (page.hidden = page.dataset.page !== name));
  breadcrumbRecord.textContent = name === "receipt" ? "EVAL-R02" : "DES-01";
  history.replaceState(null, "", `#${name}`);
  scrollTo(0, 0);
}

openReceipt.addEventListener("click", () => {
  showPage("receipt");
  receiptHeading.focus();
});

returnToRequirements.addEventListener("click", () => {
  showPage("requirements");
  openReceipt.focus();
});

reviewForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(reviewForm);
  reviewFeedback.textContent = `Saved for this study session: ${data.get("judgment")}. The recorded outcome is unchanged.`;
  reviewFeedback.hidden = false;
  reviewStates.forEach((state) => (state.textContent = "Study judgment saved"));
  reviewForm.querySelector('button[type="submit"]').textContent = "Update judgment";
});

showPage(location.hash === "#receipt" ? "receipt" : "requirements");

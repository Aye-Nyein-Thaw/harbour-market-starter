import { getJSON, postJSON, request, HttpError } from "./api.js";

const dialog = document.createElement("dialog");
dialog.className = "reviews-dialog";
dialog.innerHTML = `
  <form method="dialog" class="reviews-close-form">
    <button type="submit" aria-label="Close reviews">Close</button>
  </form>
  <h2 class="reviews-title">Reviews</h2>
  <p class="reviews-status" role="status"></p>
  <ul class="reviews-list"></ul>
  <p class="reviews-error" role="alert"></p>
  <form class="review-form">

 <!--  added for review wall section -->
<label for="review-author">Your name</label>
<input id="review-author" name="author" maxlength="40" required>
<p class="field-error" data-field="author"></p>
<!--   #################### -->

    <label for="review-rating">Rating</label>
    <select id="review-rating" name="rating" required>
      <option value="">Choose a rating</option>
      <option value="5">★★★★★ (5)</option>
      <option value="4">★★★★☆ (4)</option>
      <option value="3">★★★☆☆ (3)</option>
      <option value="2">★★☆☆☆ (2)</option>
      <option value="1">★☆☆☆☆ (1)</option>
    </select>
    <p class="field-error" data-field="rating"></p>
    <label for="review-message">Your review</label>
    
    <!--  previous version -->
    <!--  <textarea id="review-message" name="message" minlength="1" required></textarea> -->
    
    <!--   new version for review wall section -->
    <textarea id="review-message" name="text" minlength="10" maxlength="280" required></textarea>

    <!--   previous version -->
    <!--   <p class="field-error" data-field="message"></p> -->

    <!--  new version for review wall section -->
    <p class="field-error" data-field="text"></p>

    <button class="review-submit" type="submit">Post review</button>
  </form>
`;
document.body.append(dialog);

const title = dialog.querySelector(".reviews-title");
const status = dialog.querySelector(".reviews-status");
const list = dialog.querySelector(".reviews-list");
const errorMessage = dialog.querySelector(".reviews-error");
const form = dialog.querySelector(".review-form");
const ratingInput = dialog.querySelector("#review-rating");
const messageInput = dialog.querySelector("#review-message");
const submitButton = dialog.querySelector(".review-submit");

let currentStallId = null;
let requestNumber = 0;

const OWN_REVIEWS_KEY = "harbour-own-reviews";

function ownReviews() {
  try {
    return JSON.parse(localStorage.getItem(OWN_REVIEWS_KEY)) || [];
  } catch {
    return [];
  }
}

function rememberOwnReview(id) {
  if (id == null) return;
  const ids = ownReviews();
  if (!ids.includes(String(id))) ids.push(String(id));
  localStorage.setItem(OWN_REVIEWS_KEY, JSON.stringify(ids));
}

function showFieldErrors(fields = {}) {
  dialog.querySelectorAll(".field-error").forEach((element) => {
    const field = element.dataset.field;
    const message = fields[field];
    element.textContent = Array.isArray(message)
      ? message.join(" ")
      : message || "";
    const input = form.elements[field];
    if (input) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  });
}

function showReviews(reviews) {
  list.replaceChildren();

  if (!reviews.length) {
    const item = document.createElement("li");
    item.textContent = "No reviews yet: be the first!";
    list.append(item);
    return;
  }

  for (const review of reviews) {
    const item = document.createElement("li");
    const rating = document.createElement("p");
    rating.textContent = `★ ${review.rating ?? "—"}`;

    const message = document.createElement("p");
    // previous version
    // message.textContent = review.message ?? review.text ?? "";
    // new version for review wall section
    message.textContent = review.text ?? review.message ?? "";

    item.append(rating, message);

    const reviewId = review.id;
    if (reviewId != null && ownReviews().includes(String(reviewId))) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete my review";
      deleteButton.addEventListener("click", () => deleteReview(reviewId));
      item.append(deleteButton);
    }

    list.append(item);
  }
}

async function loadReviews(stallId, number) {
  status.textContent = "Loading reviews…";
  errorMessage.textContent = "";
  list.replaceChildren();

  try {
    const reviews = await getJSON(
      `/stalls/${encodeURIComponent(stallId)}/reviews`,
    );

    if (number !== requestNumber) return;

    status.textContent = "";
    showReviews(Array.isArray(reviews) ? reviews : []);
  } catch (error) {
    if (number !== requestNumber) return;
    console.error(error);
    status.textContent = "";
    errorMessage.textContent =
      error instanceof HttpError
        ? `Could not load reviews: server answered ${error.status}.`
        : "Could not load reviews. Check your connection and try again.";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => loadReviews(stallId, number));
    list.replaceChildren(retry);
  }
}

async function deleteReview(reviewId) {
  errorMessage.textContent = "";

  try {
    await request("DELETE", `/reviews/${encodeURIComponent(reviewId)}`);
    await loadReviews(currentStallId, ++requestNumber);
    await refreshCurrentStall();
  } catch (error) {
    console.error(error);
    errorMessage.textContent =
      error instanceof HttpError
        ? `Could not delete review: server answered ${error.status}.`
        : "Could not delete review. Please try again.";
  }
}

// This has been replaced by a new function for "review" wall brief
// async function refreshCurrentStall() {
//   if (currentStallId == null) return;
//   try {
//     await getJSON(`/stalls/${encodeURIComponent(currentStallId)}`);
//     document.dispatchEvent(
//       new CustomEvent("reviews:refresh-stall", {
//         detail: { stallId: String(currentStallId) },
//       }),
//     );
//   } catch (error) {
//     console.error(error);
//   }
// }

async function refreshCurrentStall() {
  if (currentStallId == null) return;

  document.dispatchEvent(
    new CustomEvent("reviews:refresh-stall", {
      detail: { stallId: String(currentStallId) },
    }),
  );
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitButton.disabled || currentStallId == null) return;

  errorMessage.textContent = "";
  showFieldErrors();
  submitButton.disabled = true;

  try {
    const result = await postJSON(
      `/stalls/${encodeURIComponent(currentStallId)}/reviews`,
      // {
      //   rating: Number(ratingInput.value),
      //   message: messageInput.value,
      // }
      {
        author: form.elements.author.value.trim(),
        rating: Number(ratingInput.value),
        text: messageInput.value.trim(),
      },
    );

    const review = result?.review ?? result;
    rememberOwnReview(review?.id);

    form.reset();
    await loadReviews(currentStallId, ++requestNumber);
    await refreshCurrentStall();
  } catch (error) {
    console.error(error);

    if (error instanceof HttpError && error.status === 422) {
      showFieldErrors(error.body?.fields ?? {});
      errorMessage.textContent = "";
    } else {
      errorMessage.textContent =
        error instanceof HttpError
          ? `Could not post review: server answered ${error.status}. Your text has been kept.`
          : "Could not post review. Check your connection and try again. Your text has been kept.";
    }
  } finally {
    submitButton.disabled = false;
  }
});

export function setupReviews() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".reviews-button");
    if (!button) return;

    const stall = button.closest(".stall");
    if (!stall) return;

    currentStallId = stall.dataset.id;
    requestNumber++;
    title.textContent = `Reviews for ${stall.querySelector("h3").textContent}`;
    form.reset();
    showFieldErrors();
    errorMessage.textContent = "";
    dialog.showModal();
    loadReviews(currentStallId, requestNumber);
  });

  dialog.addEventListener("close", () => {
    requestNumber++;
  });
}

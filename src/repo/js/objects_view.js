function drawObjectStatus(context, cssContext, imgContext, textContext, statusText, statusUpdate) {
	document.getElementById(context + "_status").className = cssContext + "-status " + cssContext + "-status-" + statusText;
	document.getElementById(context + "_status_img").src = "../../../img/" + imgContext + "-" + statusText + "-white.svg";
	document.getElementById(context + "_status_text").innerHTML = statusText[0].toUpperCase() + statusText.substr(1);

	document.getElementById("comment_submit_close").innerHTML = "Comment and " + statusUpdate;
}
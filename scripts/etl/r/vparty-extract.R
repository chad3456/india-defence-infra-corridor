# Extract V-Party's party-position variables and their codebook entries from
# the V-Dem Institute's own R package data (vdemdata), as CSV. Base R only.
#   Rscript vparty-extract.R <vparty.RData> <codebook.RData> <out-dir>
args <- commandArgs(trailingOnly = TRUE)
load(args[1]); load(args[2])
out <- args[3]
ids <- c("country_name", "country_text_id", "year", "v2paid", "v2paenname", "v2paorname", "v2pashname", "v2pavote", "v2paseatshare", "v2pagovsup")
stems <- c("v2pariglef", "v2pawelf", "v2paimmig", "v2palgbt", "v2parelig", "v2pawomlab", "v2paplur", "v2paminor", "v2paviol",
           "v2paopresp", "v2paanteli", "v2papeople", "v2paculsup", "v2paclient", "v2xpa_antiplural", "v2xpa_popul")
cols <- names(vparty)
keep <- c(intersect(ids, cols), cols[cols %in% stems | cols %in% paste0(stems, "_osp") | cols %in% paste0(stems, "_codelow") | cols %in% paste0(stems, "_codehigh")])
write.csv(vparty[, keep], file.path(out, "vparty-slim.csv"), row.names = FALSE, na = "")
writeLines(cols, file.path(out, "vparty-columns.txt"))
# The codebook's shape is not documented in the package: find the column that holds variable tags.
cb <- as.data.frame(codebook)
tagcol <- names(cb)[sapply(cb, function(x) any(as.character(x) %in% stems))][1]
writeLines(names(cb), file.path(out, "codebook-columns.txt"))
if (!is.na(tagcol)) {
  rows <- cb[as.character(cb[[tagcol]]) %in% c(stems, ids), ]
  write.csv(rows, file.path(out, "vparty-codebook.csv"), row.names = FALSE, na = "")
}
cat("rows", nrow(vparty), "cols kept", length(keep), "tag column", tagcol, "\n")

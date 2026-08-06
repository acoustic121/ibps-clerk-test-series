import Foundation
import Vision
import AppKit
import PDFKit

let pdfPath = "/Users/aman.singh/Documents/banking/question bank/Computer_Godfather_Toppers_Handbook_ENGLISH_Medium_DATA_SAVER.pdf"
let outPath = "/Users/aman.singh/Documents/banking/test-series-app/scripts/computer_ocr_raw.json"

guard let pdfDoc = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
    print("Failed to load PDF: \(pdfPath)")
    exit(1)
}

let pageCount = pdfDoc.pageCount
print("Processing \(pageCount) pages in parallel...")

var pageResults = [Int: String]()
let lock = NSLock()
let group = DispatchGroup()
let queue = DispatchQueue(label: "ocr.queue", attributes: .concurrent)

for i in 0..<pageCount {
    group.enter()
    queue.async {
        autoreleasepool {
            guard let page = pdfDoc.page(at: i) else {
                group.leave()
                return
            }
            let bounds = page.bounds(for: .mediaBox)
            let renderer = NCGraphicsRenderer(bounds: bounds)
            
            // Render PDF page to CGImage
            let dpiScale: CGFloat = 1.5
            let width = Int(bounds.width * dpiScale)
            let height = Int(bounds.height * dpiScale)
            
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            guard let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
                group.leave()
                return
            }
            
            ctx.scaleBy(x: dpiScale, y: dpiScale)
            page.draw(with: .mediaBox, to: ctx)
            
            guard let cgImage = ctx.makeImage() else {
                group.leave()
                return
            }
            
            var textLines = [String]()
            let request = VNRecognizeTextRequest { req, err in
                guard let obs = req.results as? [VNRecognizedTextObservation] else { return }
                for ob in obs {
                    if let cand = ob.topCandidates(1).first {
                        textLines.append(cand.string)
                    }
                }
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            try? handler.perform([request])
            
            let fullPageText = textLines.joined(separator: "\n")
            lock.lock()
            pageResults[i + 1] = fullPageText
            lock.unlock()
            
            group.leave()
        }
    }
}

group.wait()
print("OCR finished for all \(pageResults.count) pages.")

var sortedResults = [[String: Any]]()
for pno in 1...pageCount {
    sortedResults.append([
        "page": pno,
        "text": pageResults[pno] ?? ""
    ])
}

if let jsonData = try? JSONSerialization.data(withJSONObject: sortedResults, options: .prettyPrinted) {
    try? jsonData.write(to: URL(fileURLWithPath: outPath))
    print("Saved OCR raw output to \(outPath)")
}

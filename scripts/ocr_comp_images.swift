import Foundation
import Vision
import AppKit

let imgDir = "/tmp/comp_pages"
let outPath = "/Users/aman.singh/Documents/banking/test-series-app/scripts/computer_ocr_raw.json"

let fm = FileManager.default
guard let files = try? fm.contentsOfDirectory(atPath: imgDir) else {
    print("Failed to list files in \(imgDir)")
    exit(1)
}

let pngFiles = files.filter { $0.hasSuffix(".png") }.sorted()
print("Found \(pngFiles.count) PNG files to OCR...")

var pageResults = [Int: String]()
let lock = NSLock()
let group = DispatchGroup()
let queue = DispatchQueue(label: "ocr.queue", attributes: .concurrent)

for file in pngFiles {
    guard let pageNumStr = file.components(separatedBy: "_").last?.components(separatedBy: ".").first,
          let pageNum = Int(pageNumStr) else { continue }
    
    let filePath = "\(imgDir)/\(file)"
    group.enter()
    queue.async {
        autoreleasepool {
            guard let image = NSImage(contentsOfFile: filePath),
                  let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
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
            pageResults[pageNum] = fullPageText
            lock.unlock()
            
            group.leave()
        }
    }
}

group.wait()
print("OCR completed for \(pageResults.count) pages.")

var sortedResults = [[String: Any]]()
for pno in 1...pngFiles.count {
    sortedResults.append([
        "page": pno,
        "text": pageResults[pno] ?? ""
    ])
}

if let jsonData = try? JSONSerialization.data(withJSONObject: sortedResults, options: .prettyPrinted) {
    try? jsonData.write(to: URL(fileURLWithPath: outPath))
    print("Saved OCR raw output to \(outPath)")
}

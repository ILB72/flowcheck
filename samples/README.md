# 예시 CSV 출처

이 폴더의 CSV 2개는 FlowCheck를 위해 **합성**한 분류 결과 라벨 목록입니다. 둘 다 **논문의 실제 분류 결과가 아닙니다**(등록되지 않은 기기(PC) 논문 사례는 논문 표의 건수를 풀어 쓴 것).

- `sample_known_devices.csv`(화면 이름: 등록된 기기 예시, 합성): 열 `actual,predicted`, 100행(5개 클래스 각 20행). 98행이 정답과 일치, 2행 불일치(SamsungSmartThings→AmazonEcho 1건, TPLinkSmartPlug→SamsungSmartThings 1건). 등록된 5종 기기의 트래픽을 분류한 경우를 보여 주려는 임의 예시이며, 정확도 98.00%로 계산됩니다. 화면에서 불러오면 정확도·판정과 함께 예측 분포(BelkinCamera 20, AmazonEcho 21, SamsungSmartThings 20, NetatmoWeatherStation 20, TPLinkSmartPlug 19건)를 비교용 막대로 보여 줍니다.
- `sample_paper_pc.csv`(화면 이름: 등록되지 않은 기기(PC) 논문 사례): 열 `predicted`, 697행. 논문 표의 PC 트래픽 697 Flow 분류 건수(BelkinCamera 392, AmazonEcho 186, SamsungSmartThings 100, NetatmoWeatherStation 18, TPLinkSmartPlug 1)를 라벨 목록으로 풀어 쓴 것. 행 순서는 섞었습니다.

UNSW-IoTraffic 원자료, 실제 트래픽, 식별자(IP·MAC 등)는 포함하지 않습니다.

# 예시 CSV 출처

이 폴더의 CSV 2개는 FlowCheck를 위해 **합성**한 분류 결과 라벨 목록입니다. 둘 다 **논문의 실제 분류 결과가 아닙니다**(논문 PC 사례는 논문 표의 건수를 풀어 쓴 것).

- `sample_known_devices.csv`: 열 `actual,predicted`, 100행(5개 클래스 각 20행). 98행 일치, 2행 오분류(SamsungSmartThings→AmazonEcho 1건, TPLinkSmartPlug→SamsungSmartThings 1건). 5종 기기를 제대로 분류한 경우를 보여 주려는 임의 예시이며, 정확도 98.00%로 계산됩니다.
- `sample_paper_pc.csv`: 열 `predicted`, 697행. 논문 표의 PC 트래픽 697 Flow 분류 건수(BelkinCamera 392, AmazonEcho 186, SamsungSmartThings 100, NetatmoWeatherStation 18, TPLinkSmartPlug 1)를 라벨 목록으로 풀어 쓴 것. 행 순서는 섞었습니다.

UNSW-IoTraffic 원자료, 실제 트래픽, 식별자(IP·MAC 등)는 포함하지 않습니다.
